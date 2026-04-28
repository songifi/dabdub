import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as StellarSdk from '@stellar/stellar-sdk';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class StellarService implements OnModuleInit {
  private readonly logger = new Logger(StellarService.name);
  private readonly exchangeRateCacheKey = 'exchange-rate:xlm-usd';
  private readonly exchangeRateTtlSeconds = 30;
  private server: StellarSdk.Horizon.Server;
  private keypair: StellarSdk.Keypair;
  private networkPassphrase: string;
  private usdcAsset: StellarSdk.Asset;

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
}
