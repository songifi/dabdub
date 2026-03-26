import {
  BadRequestException,
  BadGatewayException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CheesePayContractClient,
  type SignedTransaction,
  type SimulatedTransaction,
  type SimulationResult,
  SorobanClient,
} from './soroban.client';

export interface AdminKeypair {
  readonly secretKey: string;
  readonly publicKey: string;
}

@Injectable()
export class SorobanService {
  readonly server: SorobanClient.Server;
  readonly contractClient: CheesePayContractClient;
  readonly adminKeypair: AdminKeypair;
  readonly networkPassphrase: string;

  constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.requireConfig('STELLAR_RPC_URL');
    const contractId = this.requireConfig('CONTRACT_ID', 'STELLAR_CONTRACT_ID');
    const adminSecretKey = this.requireConfig(
      'ADMIN_SECRET_KEY',
      'STELLAR_ADMIN_SECRET_KEY',
    );
    this.networkPassphrase = this.requireConfig(
      'STELLAR_NETWORK_PASSPHRASE',
      'NETWORK_PASSPHRASE',
    );

    this.server = new SorobanClient.Server(rpcUrl);
    this.contractClient = new CheesePayContractClient(contractId);
    this.adminKeypair = {
      secretKey: adminSecretKey,
      publicKey: this.derivePublicKey(adminSecretKey),
    };
  }

  async getAddress(username: string): Promise<unknown> {
    return this.invokeRead('get_address', [username]);
  }

  async getUsername(address: string): Promise<unknown> {
    return this.invokeRead('get_username', [address]);
  }

  async getBalance(username: string): Promise<unknown> {
    return this.invokeRead('get_balance', [username]);
  }

  async getStakeBalance(username: string): Promise<unknown> {
    return this.invokeRead('get_stake_balance', [username]);
  }

  async getFeeRate(): Promise<unknown> {
    return this.invokeRead('get_fee_rate', []);
  }

  async isContractPaused(): Promise<unknown> {
    return this.invokeRead('is_contract_paused', []);
  }

  async registerUser(username: string, address: string): Promise<unknown> {
    return this.invokeWrite('register_user', [username, address]);
  }

  async deposit(username: string, amount: string): Promise<unknown> {
    return this.invokeWrite('deposit', [username, amount]);
  }

  async withdraw(username: string, amount: string): Promise<unknown> {
    return this.invokeWrite('withdraw', [username, amount]);
  }

  async transfer(
    from: string,
    to: string,
    amount: string,
    note: string,
  ): Promise<unknown> {
    return this.invokeWrite('transfer', [from, to, amount, note]);
  }

  async createPayLink(
    creatorUsername: string,
    tokenId: string,
    amount: string,
    note: string,
  ): Promise<unknown> {
    return this.invokeWrite('create_pay_link', [
      creatorUsername,
      tokenId,
      amount,
      note,
    ]);
  }

  async payPayLink(payerUsername: string, tokenId: string): Promise<unknown> {
    return this.invokeWrite('pay_pay_link', [payerUsername, tokenId]);
  }

  async cancelPayLink(
    creatorUsername: string,
    tokenId: string,
  ): Promise<unknown> {
    return this.invokeWrite('cancel_pay_link', [creatorUsername, tokenId]);
  }

  async stake(username: string, amount: string): Promise<unknown> {
    return this.invokeWrite('stake', [username, amount]);
  }

  async unstake(username: string, amount: string): Promise<unknown> {
    return this.invokeWrite('unstake', [username, amount]);
  }

  async creditYield(username: string, amount: string): Promise<unknown> {
    return this.invokeWrite('credit_yield', [username, amount]);
  }

  async setFeeRate(feeRateBps: string): Promise<unknown> {
    return this.invokeWrite('set_fee_rate', [feeRateBps]);
  }

  async pause(): Promise<unknown> {
    return this.invokeWrite('pause', []);
  }

  async unpause(): Promise<unknown> {
    return this.invokeWrite('unpause', []);
  }

  mapContractErrorCode(code: number): HttpException {
    switch (code) {
      case 3:
        return new ServiceUnavailableException('Contract is paused');
      case 5:
        return new BadRequestException('Insufficient balance');
      case 6:
        return new NotFoundException('User not found');
      case 7:
        return new ForbiddenException('Unauthorized operation');
      case 8:
        return new BadRequestException('Invalid transfer amount');
      default:
        return new BadGatewayException(
          `Contract execution failed with code ${code}`,
        );
    }
  }

  private async invokeRead(
    method: string,
    args: readonly unknown[],
  ): Promise<unknown> {
    const tx = this.contractClient.buildInvokeTransaction(
      method,
      args,
      this.adminKeypair.publicKey,
    );
    const simulation = await this.server.simulateTransaction(tx);
    this.assertSimulationOk(simulation, method, true);
    return simulation.result ?? null;
  }

  private async invokeWrite(
    method: string,
    args: readonly unknown[],
  ): Promise<unknown> {
    const tx = this.contractClient.buildInvokeTransaction(
      method,
      args,
      this.adminKeypair.publicKey,
    );
    const simulation = await this.server.simulateTransaction(tx);
    this.assertSimulationOk(simulation, method, false);

    const assembled = this.server.assembleTransaction(tx, simulation);
    const signed = this.signTransaction(assembled);
    const submit = await this.server.sendTransaction(signed);

    if (!submit.ok) {
      const contractErrorCode = this.extractContractErrorCode(submit);
      if (typeof contractErrorCode === 'number') {
        throw this.mapContractErrorCode(contractErrorCode);
      }
      throw new BadGatewayException(
        `Soroban submission failed for ${method}: ${submit.error ?? 'unknown error'}`,
      );
    }

    return submit.result ?? null;
  }

  private assertSimulationOk(
    simulation: SimulationResult,
    method: string,
    mapContractErrors: boolean,
  ): void {
    if (!simulation.ok) {
      const contractErrorCode = this.extractContractErrorCode(simulation);
      if (mapContractErrors && typeof contractErrorCode === 'number') {
        throw this.mapContractErrorCode(contractErrorCode);
      }
      throw new BadGatewayException(
        `Soroban simulation failed for ${method}: ${simulation.error ?? 'unknown error'}`,
      );
    }
  }

  private extractContractErrorCode(
    value: Pick<SimulationResult, 'contractErrorCode' | 'contractErrorXdr'>,
  ): number | undefined {
    if (typeof value.contractErrorCode === 'number') {
      return value.contractErrorCode;
    }
    if (!value.contractErrorXdr) {
      return undefined;
    }

    const match = value.contractErrorXdr.match(
      /(?:code|contract(?:_error)?)[^\d]*(\d+)/i,
    );
    if (!match) {
      return undefined;
    }

    const parsed = Number.parseInt(match[1] ?? '', 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private signTransaction(
    tx: SimulatedTransaction & { simulation: SimulationResult },
  ): SignedTransaction {
    return {
      ...tx,
      signature: `sig:${this.adminKeypair.publicKey}`,
    };
  }

  private derivePublicKey(secretKey: string): string {
    const suffix = secretKey.slice(-8);
    return `G${suffix.padStart(8, '0')}`;
  }

  private requireConfig(...keys: string[]): string {
    for (const key of keys) {
      const value = this.configService.get<string>(key);
      if (value && value.trim().length > 0) {
        return value;
      }
    }
    throw new Error(
      `Missing required config value. Checked keys: ${keys.join(', ')}`,
    );
  }
}
import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  Contract,
  SorobanRpc,
  Keypair,
  nativeToScVal,
  scValToNative,
} from 'stellar-sdk';
import type { ConfigType } from '@nestjs/config';
import { stellarConfig } from '../config/stellar.config';

@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);
  private readonly server: SorobanRpc.Server;
  private readonly contract: Contract;
  private readonly adminKeypair: Keypair;

  constructor(
    @Inject(stellarConfig.KEY)
    stellarCfg: ConfigType<typeof stellarConfig>,
  ) {
    this.server = new SorobanRpc.Server(stellarCfg.rpcUrl);
    this.contract = new Contract(stellarCfg.contractId);
    this.adminKeypair = Keypair.fromSecret(stellarCfg.adminSecretKey);
  }

  async deposit(userId: string, usdcAmount: number): Promise<void> {
    try {
      // This is a placeholder implementation
      // In a real implementation, you would:
      // 1. Build a transaction to call the deposit function on the smart contract
      // 2. Sign it with the admin keypair
      // 3. Submit to the network

      this.logger.log(
        `Depositing ${usdcAmount} USDC to user ${userId} via Soroban contract`,
      );

      // Placeholder: simulate the deposit
      // const account = await this.server.getAccount(this.adminKeypair.publicKey());
      // const tx = new TransactionBuilder(account, {
      //   fee: '100',
      //   networkPassphrase: this.networkPassphrase,
      // })
      //   .addOperation(
      //     this.contract.call('deposit', nativeToScVal(userId), nativeToScVal(usdcAmount)),
      //   )
      //   .setTimeout(30)
      //   .build();

      // const preparedTx = await this.server.prepareTransaction(tx);
      // preparedTx.sign(this.adminKeypair);
      // const result = await this.server.sendTransaction(preparedTx);

      // For now, just log success
      this.logger.log(
        `Successfully deposited ${usdcAmount} USDC to user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to deposit USDC for user ${userId}: ${error.message}`,
      );
      throw error;
    }
  }
}
