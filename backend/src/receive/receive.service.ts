import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { User } from '../users/entities/user.entity';
import { appConfig } from '../config/app.config';
import { stellarConfig } from '../config/stellar.config';
import { VirtualAccountService } from '../virtual-account/virtual-account.service';
import { PayLinkService } from '../paylink/paylink.service';
import { CacheService } from '../cache/cache.service';
import { CreatePayLinkDto } from '../paylink/dto/create-pay-link.dto';
import { CreateReceivePayLinkDto } from './dto/create-receive-paylink.dto';

const QR_WIDTH = 300;
const RECEIVE_QR_TTL_SECONDS = 3600;
const USER_PAY_SCHEME = 'cheesewallet://';
const VIRTUAL_ACCOUNT_AMOUNT_NOTE =
  'Any amount in NGN. Use the account details shown; credits convert to USDC at the current rate.';

export type ReceiveInfoVirtualAccount = {
  accountNumber: string;
  bankName: string;
  reference: string;
};

export type ReceiveInfoResponse = {
  stellarAddress: string;
  memo: string;
  virtualAccount: ReceiveInfoVirtualAccount | null;
  paylinks: number;
};

export type StellarReceiveResponse = {
  address: string;
  memo: string;
  network: 'stellar';
  assetCode: 'USDC';
  assetIssuer: string;
  qrDataUrl: string;
};

export type VirtualAccountReceiveResponse = ReceiveInfoVirtualAccount & {
  amountNote: string;
};

export type ReceivePaylinkResponse = {
  paylinkUrl: string;
  qrDataUrl: string;
  tokenId: string;
};

export type ReceiveQrBundleResponse = {
  stellarQr: string;
  virtualAccountQr: string;
  usernameQr: string;
};

@Injectable()
export class ReceiveService {
  constructor(
    @Inject(stellarConfig.KEY)
    private readonly stellar: ConfigType<typeof stellarConfig>,
    @Inject(appConfig.KEY)
    private readonly app: ConfigType<typeof appConfig>,
    private readonly virtualAccountService: VirtualAccountService,
    private readonly payLinkService: PayLinkService,
    private readonly cache: CacheService,
  ) {}

  buildStellarPaymentUri(address: string, memo: string, assetIssuer: string): string {
    const params = new URLSearchParams({
      destination: address,
      memo,
      memo_type: 'text',
      asset_code: 'USDC',
      asset_issuer: assetIssuer,
    });
    return `web+stellar:pay?${params.toString()}`;
  }

  async getInfo(user: User): Promise<ReceiveInfoResponse> {
    const [virtualAccount, paylinks] = await Promise.all([
      this.virtualAccountService.findExistingByUserId(user.id),
      this.payLinkService.countActiveReceiveLinks(user.id),
    ]);

    return {
      stellarAddress: this.stellar.receiveAddress,
      memo: user.username,
      virtualAccount: virtualAccount
        ? {
            accountNumber: virtualAccount.accountNumber,
            bankName: virtualAccount.bankName,
            reference: virtualAccount.reference,
          }
        : null,
      paylinks,
    };
  }

  async getStellarReceive(user: User): Promise<StellarReceiveResponse> {
    const uri = this.buildStellarPaymentUri(
      this.stellar.receiveAddress,
      user.username,
      this.stellar.usdcIssuer,
    );
    const qrDataUrl = await this.toQrDataUrl(uri);

    return {
      address: this.stellar.receiveAddress,
      memo: user.username,
      network: 'stellar',
      assetCode: 'USDC',
      assetIssuer: this.stellar.usdcIssuer,
      qrDataUrl,
    };
  }

  async getVirtualAccountReceive(user: User): Promise<VirtualAccountReceiveResponse> {
    const va = await this.virtualAccountService.getOrProvision(user.id);
    return {
      accountNumber: va.accountNumber,
      bankName: va.bankName,
      reference: va.reference,
      amountNote: VIRTUAL_ACCOUNT_AMOUNT_NOTE,
    };
  }

  async createPaylinkFromReceive(
    user: User,
    dto: CreateReceivePayLinkDto,
  ): Promise<ReceivePaylinkResponse> {
    const createDto: CreatePayLinkDto = {
      amount: dto.amount,
      note: dto.note,
      expiresInHours: dto.expiresInHours,
    };
    const payLink = await this.payLinkService.create(user, createDto);
    const paylinkUrl = `${this.trimBaseUrl(this.app.frontendUrl)}/paylinks/${encodeURIComponent(payLink.tokenId)}`;
    const qrDataUrl = await this.toQrDataUrl(paylinkUrl);

    return {
      paylinkUrl,
      qrDataUrl,
      tokenId: payLink.tokenId,
    };
  }

  async getQrBundle(user: User): Promise<ReceiveQrBundleResponse> {
    const cacheKey = `receive:qr:${user.id}`;
    const cached = await this.cache.get<ReceiveQrBundleResponse>(cacheKey);
    if (cached) return cached;

    const stellarUri = this.buildStellarPaymentUri(
      this.stellar.receiveAddress,
      user.username,
      this.stellar.usdcIssuer,
    );
    const va = await this.virtualAccountService.getOrProvision(user.id);
    const vaPayload = this.virtualAccountQrPayload(va.accountNumber, va.bankName, va.reference);
    const usernamePaymentUrl = `${USER_PAY_SCHEME}pay?${new URLSearchParams({ to: user.username }).toString()}`;

    const [stellarQr, virtualAccountQr, usernameQr] = await Promise.all([
      this.toQrDataUrl(stellarUri),
      this.toQrDataUrl(vaPayload),
      this.toQrDataUrl(usernamePaymentUrl),
    ]);

    const bundle = { stellarQr, virtualAccountQr, usernameQr };
    await this.cache.set(cacheKey, bundle, RECEIVE_QR_TTL_SECONDS);
    return bundle;
  }

  private virtualAccountQrPayload(
    accountNumber: string,
    bankName: string,
    reference: string,
  ): string {
    return `NGN: ${accountNumber} | ${bankName} | Ref ${reference}`;
  }

  private trimBaseUrl(url: string): string {
    return url.replace(/\/$/, '');
  }

  private async toQrDataUrl(content: string): Promise<string> {
    return QRCode.toDataURL(content, {
      errorCorrectionLevel: 'M',
      width: QR_WIDTH,
      margin: 2,
    });
  }
}
