import { Injectable, Inject } from '@nestjs/common';
import * as StellarSdk from 'stellar-sdk';
import { stellarConfig, StellarConfig } from '../config/stellar.config';
import { StellarService } from './stellar.service';
import { AccountNotFundedException } from './stellar.exceptions';

@Injectable()
export class StellarAssetService {
  constructor(
    @Inject(stellarConfig.KEY)
    private readonly config: StellarConfig,
    private readonly stellarService: StellarService,
  ) {}

  getUsdcAsset(): StellarSdk.Asset {
    return new StellarSdk.Asset('USDC', this.config.usdcIssuer);
  }

  async hasTrustLine(publicKey: string): Promise<boolean> {
    const account = await this.stellarService.loadAccount(publicKey);
    return account.balances.some(
      (b) =>
        b.asset_type === 'credit_alphanum4' &&
        (b as StellarSdk.Horizon.HorizonApi.BalanceLine<'credit_alphanum4'>).asset_code === 'USDC' &&
        (b as StellarSdk.Horizon.HorizonApi.BalanceLine<'credit_alphanum4'>).asset_issuer === this.config.usdcIssuer,
    );
  }

  async createTrustLine(publicKey: string, secretKey: string): Promise<void> {
    const account = await this.stellarService.loadAccount(publicKey);
    const xlmBalance = account.balances.find((b) => b.asset_type === 'native');
    if (!xlmBalance || parseFloat(xlmBalance.balance) < 1) {
      throw new AccountNotFundedException();
    }

    const tx = await this.stellarService.buildTransaction({
      sourceAccount: account,
      operations: [
        StellarSdk.Operation.changeTrust({
          asset: this.getUsdcAsset(),
          limit: '922337203685.4775807',
        }) as unknown as StellarSdk.xdr.Operation,
      ],
    });

    const signedXdr = this.stellarService.signTransaction(tx, secretKey);
    await this.stellarService.submitTransaction(signedXdr);
  }

  async getUsdcBalance(publicKey: string): Promise<string> {
    const account = await this.stellarService.loadAccount(publicKey);
    const entry = account.balances.find(
      (b) =>
        b.asset_type === 'credit_alphanum4' &&
        (b as StellarSdk.Horizon.HorizonApi.BalanceLine<'credit_alphanum4'>).asset_code === 'USDC' &&
        (b as StellarSdk.Horizon.HorizonApi.BalanceLine<'credit_alphanum4'>).asset_issuer === this.config.usdcIssuer,
    );
    return entry ? entry.balance : '0';
  }

  async ensureTrustLine(publicKey: string, secretKey: string): Promise<void> {
    const has = await this.hasTrustLine(publicKey);
    if (!has) {
      await this.createTrustLine(publicKey, secretKey);
    }
  }

  async getAccountDetails(publicKey: string): Promise<{
    sequence: string;
    xlmBalance: string;
    trustLines: StellarSdk.Horizon.HorizonApi.BalanceLine[];
    signers: StellarSdk.Horizon.HorizonApi.AccountSigner[];
  }> {
    const account = await this.stellarService.loadAccount(publicKey);
    const xlm = account.balances.find((b) => b.asset_type === 'native');
    return {
      sequence: account.sequence,
      xlmBalance: xlm?.balance ?? '0',
      trustLines: account.balances.filter((b) => b.asset_type !== 'native'),
      signers: account.signers,
    };
  }
}
