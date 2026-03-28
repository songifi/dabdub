import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { customAlphabet } from 'nanoid';
import type Redis from 'ioredis';
import { Repository } from 'typeorm';
import { REDIS_CLIENT } from '../cache/redis.module';
import { CreatePayLinkDto } from '../paylink/dto/create-pay-link.dto';
import { PayLink, PayLinkStatus } from '../paylink/entities/pay-link.entity';
import { PayLinkService } from '../paylink/paylink.service';
import { User } from '../users/entities/user.entity';
import { WebhookService } from '../webhooks/webhook.service';
import {
  SANDBOX_BALANCE_INITIAL_USDC,
  SANDBOX_CURRENCY,
  sandboxBalanceKey,
  sandboxTransactionsKey,
} from './sandbox.constants';

const nanoid16 = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  16,
);

@Injectable()
export class SandboxService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,

    @InjectRepository(PayLink)
    private readonly payLinkRepo: Repository<PayLink>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly payLinkService: PayLinkService,
    private readonly webhooks: WebhookService,
  ) {}

  isSandboxRequest(apiKey: string): boolean {
    return apiKey.startsWith('ck_test_');
  }

  extractMerchantIdFromApiKey(apiKey: string): string | null {
    const match = apiKey.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    );
    return match?.[0]?.toLowerCase() ?? null;
  }

  async createSandboxPayLink(
    merchantId: string,
    dto: CreatePayLinkDto,
  ): Promise<PayLink> {
    const merchantUser = await this.userRepo.findOne({ where: { id: merchantId } });
    if (!merchantUser) {
      throw new NotFoundException('Merchant user not found');
    }

    return this.payLinkService.create(merchantUser, dto, { sandbox: true });
  }

  async simulatePayment(merchantId: string, tokenId: string): Promise<{
    tokenId: string;
    txHash: string;
    balanceUsdc: string;
  }> {
    const payLink = await this.payLinkRepo.findOne({
      where: { tokenId, creatorUserId: merchantId },
    });

    if (!payLink) {
      throw new NotFoundException('Sandbox PayLink not found for this merchant');
    }

    if (!payLink.sandbox) {
      throw new ForbiddenException('Cannot simulate payment for a live PayLink');
    }

    if (payLink.status === PayLinkStatus.PAID) {
      throw new ConflictException('Sandbox PayLink already paid');
    }

    if (payLink.status === PayLinkStatus.CANCELLED) {
      throw new ConflictException('Sandbox PayLink is cancelled');
    }

    if (payLink.status === PayLinkStatus.EXPIRED || payLink.expiresAt.getTime() <= Date.now()) {
      payLink.status = PayLinkStatus.EXPIRED;
      await this.payLinkRepo.save(payLink);
      throw new ConflictException('Sandbox PayLink is expired');
    }

    const amount = Number(payLink.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ConflictException('Sandbox PayLink amount must be a positive number');
    }

    const txHash = `sandbox_${nanoid16()}`;
    payLink.status = PayLinkStatus.PAID;
    payLink.paidByUserId = merchantId;
    payLink.paymentTxHash = txHash;
    await this.payLinkRepo.save(payLink);

    const balanceUsdc = await this.creditBalance(merchantId, amount);

    await this.recordTransaction(merchantId, {
      type: 'paylink_payment',
      tokenId,
      amountUsdc: amount.toFixed(6),
      txHash,
      createdAt: new Date().toISOString(),
    });

    await this.webhooks.dispatch(
      'paylink.paid',
      {
        sandbox: true,
        tokenId,
        amount: payLink.amount,
        currency: SANDBOX_CURRENCY,
        txHash,
      },
      merchantId,
    );

    return {
      tokenId,
      txHash,
      balanceUsdc,
    };
  }

  async simulateDeposit(merchantId: string, amountUsdc: number): Promise<{ balanceUsdc: string }> {
    if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
      throw new ConflictException('amountUsdc must be greater than 0');
    }

    const balanceUsdc = await this.creditBalance(merchantId, amountUsdc);

    await this.recordTransaction(merchantId, {
      type: 'deposit',
      amountUsdc: amountUsdc.toFixed(6),
      createdAt: new Date().toISOString(),
    });

    return { balanceUsdc };
  }

  async getBalance(merchantId: string): Promise<{ currency: 'USDC'; balanceUsdc: string }> {
    const balanceUsdc = await this.getOrInitBalance(merchantId);
    return {
      currency: SANDBOX_CURRENCY,
      balanceUsdc,
    };
  }

  async resetBalance(merchantId: string): Promise<{ currency: 'USDC'; balanceUsdc: string }> {
    const balanceKey = sandboxBalanceKey(merchantId, SANDBOX_CURRENCY);
    const txKey = sandboxTransactionsKey(merchantId);

    await this.redis.set(balanceKey, SANDBOX_BALANCE_INITIAL_USDC.toFixed(6));
    await this.redis.unlink(txKey);

    return {
      currency: SANDBOX_CURRENCY,
      balanceUsdc: SANDBOX_BALANCE_INITIAL_USDC.toFixed(6),
    };
  }

  private async getOrInitBalance(merchantId: string): Promise<string> {
    const key = sandboxBalanceKey(merchantId, SANDBOX_CURRENCY);
    const existing = await this.redis.get(key);
    if (existing !== null) {
      return existing;
    }

    const initial = SANDBOX_BALANCE_INITIAL_USDC.toFixed(6);
    await this.redis.set(key, initial, 'NX');
    return (await this.redis.get(key)) ?? initial;
  }

  private async creditBalance(merchantId: string, amountUsdc: number): Promise<string> {
    const key = sandboxBalanceKey(merchantId, SANDBOX_CURRENCY);
    await this.getOrInitBalance(merchantId);
    const next = await this.redis.incrbyfloat(key, amountUsdc);
    return Number(next).toFixed(6);
  }

  private async recordTransaction(
    merchantId: string,
    tx: Record<string, unknown>,
  ): Promise<void> {
    const txKey = sandboxTransactionsKey(merchantId);
    await this.redis.lpush(txKey, JSON.stringify(tx));
    await this.redis.ltrim(txKey, 0, 499);
  }
}
