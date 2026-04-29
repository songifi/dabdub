import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { CacheService } from '../cache/cache.service';

export class SorobanRpcException extends Error {
  constructor(
    message: string,
    public readonly sorobanCode?: string,
    public readonly statusCode: number = HttpStatus.BAD_GATEWAY,
  ) {
    super(message);
    this.name = 'SorobanRpcException';
  }
}

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private readonly exchangeRateCacheKey = 'exchange-rate:xlm-usd';
  private readonly exchangeRateTtlSeconds = 30;
  private server: StellarSdk.Horizon.Server;
  private sorobanRpcServer: StellarSdk.rpc.Server;
  private keypair: StellarSdk.Keypair;
  private networkPassphrase: string;
  private usdcAsset: StellarSdk.Asset;
  private sorobanContractId: string;

  constructor(
    private config: ConfigService,
    private readonly cacheService: CacheService,
  ) {}

  onModuleInit() {
    const network = this.config.get('STELLAR_NETWORK', 'TESTNET');
    const horizonUrl = this.config.get(
      'STELLAR_HORIZON_URL',
      network === 'PUBLIC'
        ? 'https://horizon.stellar.org'
        : 'https://horizon-testnet.stellar.org',
    );

    this.server = new StellarSdk.Horizon.Server(horizonUrl);
    this.sorobanRpcServer = new StellarSdk.rpc.Server(
      this.config.get('SOROBAN_RPC_URL', 'https://soroban-testnet.stellar.org'),
    );
    this.networkPassphrase =
      network === 'PUBLIC'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET;

    const secret = this.config.get('STELLAR_ACCOUNT_SECRET');
    if (secret) {
      this.keypair = StellarSdk.Keypair.fromSecret(secret);
    }

    const usdcIssuer = this.config.get(
      'STELLAR_USDC_ISSUER',
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    );
    this.usdcAsset = new StellarSdk.Asset('USDC', usdcIssuer);
    this.sorobanContractId = this.config.get('SOROBAN_CONTRACT_ID', '');

    this.logger.log(`Stellar initialized on ${network}`);
  }

  getDepositAddress(): string {
    return this.keypair?.publicKey() ?? this.config.get('STELLAR_ACCOUNT_PUBLIC', '');
  }

  generateMemo(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  async getXlmUsdRate(): Promise<number> {
    const { value } = await this.cacheService.getOrSet<number>(
      this.exchangeRateCacheKey,
      async () => {
        try {
          const orderbook = await this.server
            .orderbook(StellarSdk.Asset.native(), this.usdcAsset)
            .call();
          const bestAsk = orderbook.asks[0];
          if (bestAsk) return parseFloat(bestAsk.price);

          return 0.1;
        } catch (err) {
          this.logger.warn('Failed to fetch XLM/USD rate, using fallback');
          return 0.1;
        }
      },
      { ttlSeconds: this.exchangeRateTtlSeconds },
    );

    return value;
  }

  async getAccountTransactions(
    accountId: string,
    cursor?: string,
  ): Promise<StellarSdk.Horizon.ServerApi.TransactionRecord[]> {
    const builder = this.server
      .transactions()
      .forAccount(accountId)
      .order('asc')
      .limit(200);

    if (cursor) builder.cursor(cursor);

    const page = await builder.call();
    return page.records;
  }

  async getPaymentsForTransaction(txHash: string): Promise<any[]> {
    const tx = await this.server.transactions().transaction(txHash).call();
    const operations = await tx.operations();
    return operations.records;
  }

  async verifyPayment(
    txHash: string,
    expectedMemo: string,
    expectedAmountUsdc?: number,
    assetType: 'XLM' | 'USDC' = 'USDC',
  ): Promise<{ verified: boolean; amount?: number; asset?: string; from?: string }> {
    try {
      const tx = await this.server.transactions().transaction(txHash).call();

      const memo = tx.memo;
      if (expectedMemo && memo !== expectedMemo) {
        return { verified: false };
      }

      const ops = await tx.operations();
      for (const op of ops.records as any[]) {
        if (op.type === 'payment') {
          const isUsdc =
            op.asset_code === 'USDC' &&
            op.asset_issuer === this.usdcAsset.getIssuer();
          const isXlm = op.asset_type === 'native';

          if (isUsdc || isXlm) {
            const amount = parseFloat(op.amount);
            return { verified: true, amount, asset: isUsdc ? 'USDC' : 'XLM', from: op.from };
          }
        }
      }

      return { verified: false };
    } catch {
      return { verified: false };
    }
  }

  async sendPayment(
    destinationId: string,
    amount: string,
    asset: StellarSdk.Asset,
    memo?: string,
  ): Promise<string> {
    const account = await this.server.loadAccount(this.keypair.publicKey());

    const txBuilder = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: destinationId,
          asset,
          amount,
        }),
      )
      .setTimeout(30);

    if (memo) txBuilder.addMemo(StellarSdk.Memo.text(memo));

    const tx = txBuilder.build();
    tx.sign(this.keypair);

    const result = await this.server.submitTransaction(tx);
    return result.hash;
  }

  getUsdcAsset(): StellarSdk.Asset {
    return this.usdcAsset;
  }

  /**
   * Build the asset_type argument for the payment_escrow deposit invocation.
   * Returns the ScVal enum variant expected by the Soroban contract.
   */
  buildAssetTypeScVal(assetType: 'XLM' | 'USDC'): StellarSdk.xdr.ScVal {
    return StellarSdk.xdr.ScVal.scvVec([
      StellarSdk.xdr.ScVal.scvSymbol(assetType),
    ]);
  }

  getServer(): StellarSdk.Horizon.Server {
    return this.server;
  }

  async invokeContract(fn: string, args: unknown[] = []): Promise<string> {
    if (!this.sorobanContractId) {
      throw new SorobanRpcException(
        'SOROBAN_CONTRACT_ID is not configured',
        'missing_contract_id',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    if (!this.keypair) {
      throw new SorobanRpcException(
        'STELLAR_ACCOUNT_SECRET is not configured',
        'missing_signer',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    try {
      const source = await this.server.loadAccount(this.keypair.publicKey());
      const contract = new StellarSdk.Contract(this.sorobanContractId);
      const tx = new StellarSdk.TransactionBuilder(source, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            fn,
            ...args.map((arg) => StellarSdk.nativeToScVal(arg)),
          ),
        )
        .setTimeout(30)
        .build();

      const simulated = await this.sorobanRpcServer.simulateTransaction(tx);
      if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
        throw new SorobanRpcException(
          'Soroban simulateTransaction failed',
          this.extractSorobanErrorCode(simulated.error),
          HttpStatus.BAD_REQUEST,
        );
      }

      const preparedTx = StellarSdk.rpc
        .assembleTransaction(tx, simulated)
        .build();
      preparedTx.sign(this.keypair);

      const submitted = await this.sorobanRpcServer.sendTransaction(preparedTx);
      if (submitted.status !== 'PENDING') {
        throw new SorobanRpcException(
          'Soroban sendTransaction failed',
          this.extractSorobanErrorCode(submitted.errorResult ?? submitted),
        );
      }

      return submitted.hash;
    } catch (error) {
      if (error instanceof SorobanRpcException) {
        throw error;
      }

      throw new SorobanRpcException(
        `Soroban contract invocation failed for ${fn}`,
        this.extractSorobanErrorCode(error),
      );
    }
  }

  /**
   * Read-only query: calls get_balance(payment_id) on the escrow contract via
   * simulateTransaction (no signing, no fee). Returns the on-chain remaining
   * balance in stroops (i128 represented as bigint).
   *
   * Returns null when the contract ID is not configured or the simulation fails.
   */
  async queryContractBalance(paymentId: string): Promise<bigint | null> {
    if (!this.sorobanContractId) return null;

    try {
      const contract = new StellarSdk.Contract(this.sorobanContractId);
      // Build a minimal transaction — source account is not required to exist
      // for simulation-only calls; we use a well-known testnet account as a
      // placeholder when no keypair is configured.
      const sourcePublicKey = this.keypair
        ? this.keypair.publicKey()
        : 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

      const source = new StellarSdk.Account(sourcePublicKey, '0');
      const tx = new StellarSdk.TransactionBuilder(source, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'get_balance',
            StellarSdk.nativeToScVal(paymentId, { type: 'bytes' }),
          ),
        )
        .setTimeout(30)
        .build();

      const simulated = await this.sorobanRpcServer.simulateTransaction(tx);
      if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
        this.logger.warn(
          `get_balance simulation error for payment ${paymentId}: ${simulated.error}`,
        );
        return null;
      }

      const result = (simulated as StellarSdk.rpc.Api.SimulateTransactionSuccessResponse)
        .result?.retval;
      if (!result) return null;

      // The contract returns i128; scValToNative converts it to bigint.
      return BigInt(StellarSdk.scValToNative(result) as string | number | bigint);
    } catch (err) {
      this.logger.warn(
        `queryContractBalance failed for payment ${paymentId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private extractSorobanErrorCode(error: unknown): string {
    const serialized =
      typeof error === 'string' ? error : JSON.stringify(error ?? {});
    if (serialized.includes('tx_bad_auth')) return 'tx_bad_auth';
    if (serialized.includes('tx_insufficient_fee')) return 'tx_insufficient_fee';
    if (serialized.includes('tx_too_late')) return 'tx_too_late';
    if (serialized.includes('host_fn_failed')) return 'host_fn_failed';
    if (serialized.includes('resource_limit_exceeded')) {
      return 'resource_limit_exceeded';
    }
    return 'soroban_rpc_error';
  }
}
