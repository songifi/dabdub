import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { FeeConfig, FeeType } from '../fee-config/entities/fee-config.entity';
import { User } from '../users/entities/user.entity';
import { SorobanService } from '../soroban/soroban.service';
import { Transaction, TransactionType } from '../transactions/entities/transaction.entity';
import { InitiateResponseDto } from './dto/initiate-response.dto';
import { PreviewResponseDto } from './dto/preview.dto';
import { FlutterwaveClient } from './flutterwave.client';
import { OnRampOrder, OnRampStatus } from './onramp-order.entity';

const DEFAULT_RATE_NGN_PER_USDC = 1600;
const DEFAULT_SPREAD_PERCENT = 1.5;
const DEFAULT_PAYMENT_DEADLINE_MINUTES = 30;
const DEFAULT_AMOUNT_TOLERANCE_NGN = 1;

interface HandleWebhookPayload {
  type?: string;
  'event.type'?: string;
  data?: {
    id?: string | number;
    tx_ref?: string;
    flw_ref?: string;
    amount?: string | number;
    narration?: string;
    status?: string;
    account_number?: string;
  };
  meta_data?: {
    bankname?: string;
    originatoraccountnumber?: string;
  };
}

@Injectable()
export class OnRampService {
  private readonly logger = new Logger(OnRampService.name);

  constructor(
    @InjectRepository(OnRampOrder)
    private readonly orderRepo: Repository<OnRampOrder>,
    @InjectRepository(FeeConfig)
    private readonly feeConfigRepo: Repository<FeeConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly configService: ConfigService,
    private readonly flutterwaveClient: FlutterwaveClient,
    private readonly sorobanService: SorobanService,
  ) {}

  async preview(
    _userId: string,
    amountNgn: number,
  ): Promise<PreviewResponseDto> {
    const feeNgn = await this.calculateFeeNgn(amountNgn);
    const netNgn = this.roundCurrency(amountNgn - feeNgn, 2);

    if (netNgn <= 0) {
      throw new BadRequestException('Amount is too low after fees');
    }

    const rateNgnPerUsdc = this.getRateNgnPerUsdc();
    const spreadPercent = this.getSpreadPercent();
    const effectiveRate = rateNgnPerUsdc * (1 + spreadPercent / 100);
    const amountUsdc = this.roundCurrency(netNgn / effectiveRate, 6);

    return {
      amountNgn: this.roundCurrency(amountNgn, 2),
      feeNgn,
      netNgn,
      amountUsdc,
      rateNgnPerUsdc,
      spreadPercent,
      paymentDeadlineMinutes: this.getPaymentDeadlineMinutes(),
    };
  }

  async initiate(
    userId: string,
    amountNgn: number,
  ): Promise<InitiateResponseDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const preview = await this.preview(userId, amountNgn);
    const reference = this.generateReference();
    const fallbackExpiresAt = new Date(
      Date.now() + this.getPaymentDeadlineMinutes() * 60_000,
    );

    const account = await this.flutterwaveClient.createVirtualAccount({
      amountNgn: preview.amountNgn,
      customerEmail: user.email,
      customerName: user.displayName ?? user.username,
      txRef: reference,
    });

    const order = this.orderRepo.create({
      userId,
      reference,
      amountNgn: preview.amountNgn.toFixed(2),
      feeNgn: preview.feeNgn.toFixed(2),
      netNgn: preview.netNgn.toFixed(2),
      amountUsdc: preview.amountUsdc.toFixed(6),
      rateNgnPerUsdc: preview.rateNgnPerUsdc.toFixed(6),
      spreadPercent: preview.spreadPercent.toFixed(4),
      status: OnRampStatus.PENDING,
      virtualAccountNumber: account.accountNumber,
      virtualAccountBankName: account.bankName,
      virtualAccountName: account.accountName,
      flutterwaveReference: account.flutterwaveReference,
      settlementReference: null,
      failureReason: null,
      webhookPayload: null,
      paidAt: null,
      creditedAt: null,
      expiresAt: account.expiresAt ?? fallbackExpiresAt,
    });

    await this.orderRepo.save(order);

    return {
      reference,
      amountNgn: preview.amountNgn,
      accountNumber: account.accountNumber,
      bankName: account.bankName,
      accountName: account.accountName,
      expiresAt: order.expiresAt,
    };
  }

  async handleWebhook(payload: HandleWebhookPayload): Promise<void> {
    const reference = this.extractReference(payload);
    if (!reference) {
      this.logger.warn(
        'Ignoring Flutterwave webhook without an on-ramp reference',
      );
      return;
    }

    const order = await this.orderRepo.findOne({ where: { reference } });
    if (!order) {
      this.logger.warn(
        `Webhook received for unknown on-ramp reference ${reference}`,
      );
      return;
    }

    if (order.status === OnRampStatus.CREDITED) {
      this.logger.debug(
        `Order ${reference} already credited; skipping duplicate webhook`,
      );
      return;
    }

    if (order.status === OnRampStatus.EXPIRED) {
      this.logger.warn(`Ignoring payment for expired order ${reference}`);
      return;
    }

    const paidAmountNgn = this.roundCurrency(
      Number(payload.data?.amount ?? 0),
      2,
    );
    const tolerance = this.getAmountToleranceNgn();
    const expectedAmountNgn = Number(order.amountNgn);

    order.flutterwaveReference =
      payload.data?.flw_ref ??
      (payload.data?.id ? String(payload.data.id) : order.flutterwaveReference);
    order.webhookPayload = payload as Record<string, unknown>;

    if (new Date() > order.expiresAt) {
      order.status = OnRampStatus.EXPIRED;
      order.failureReason = 'Payment arrived after the order expired';
      await this.orderRepo.save(order);
      return;
    }

    if (Math.abs(paidAmountNgn - expectedAmountNgn) > tolerance) {
      order.status = OnRampStatus.FAILED;
      order.paidAt = new Date();
      order.failureReason = `Amount mismatch: expected ${expectedAmountNgn}, received ${paidAmountNgn}`;
      await this.orderRepo.save(order);
      return;
    }

    order.status = OnRampStatus.PAID;
    order.paidAt = new Date();
    order.failureReason = null;

    const recalculated = await this.preview(order.userId, paidAmountNgn);
    order.feeNgn = recalculated.feeNgn.toFixed(2);
    order.netNgn = recalculated.netNgn.toFixed(2);
    order.amountUsdc = recalculated.amountUsdc.toFixed(6);

    await this.orderRepo.save(order);

    try {
      order.settlementReference = await this.creditUsdc(order);
      order.status = OnRampStatus.CREDITED;
      order.creditedAt = new Date();
      await this.orderRepo.save(order);
    } catch (error) {
      order.status = OnRampStatus.FAILED;
      order.failureReason =
        error instanceof Error ? error.message : 'Settlement failed';
      await this.orderRepo.save(order);
      throw error;
    }
  }

  async getOrders(userId: string, page: number, limit: number) {
    const [orders, total] = await this.orderRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data: orders, total, page, limit };
  }

  async getOrderById(userId: string, id: string): Promise<OnRampOrder> {
    const order = await this.orderRepo.findOne({ where: { id, userId } });
    if (!order) {
      throw new NotFoundException(`On-ramp order ${id} not found`);
    }

    return order;
  }

  async expireStaleOrders(): Promise<number> {
    const staleOrders = await this.orderRepo.find({
      where: {
        status: OnRampStatus.PENDING,
        expiresAt: LessThan(new Date()),
      },
    });

    for (const order of staleOrders) {
      order.status = OnRampStatus.EXPIRED;
      order.failureReason = 'Payment window expired';
      await this.orderRepo.save(order);
    }

    return staleOrders.length;
  }

  private async calculateFeeNgn(amountNgn: number): Promise<number> {
    const config = await this.feeConfigRepo.findOne({
      where: { feeType: FeeType.DEPOSIT, isActive: true },
    });

    if (!config) {
      return 0;
    }

    const rateFee = amountNgn * Number(config.baseFeeRate);
    let fee = Math.max(rateFee, Number(config.minFee));

    if (config.maxFee !== null) {
      fee = Math.min(fee, Number(config.maxFee));
    }

    return this.roundCurrency(fee, 2);
  }

  private getRateNgnPerUsdc(): number {
    const rate = Number(
      this.configService.get<string>('ONRAMP_NGN_USDC_RATE') ??
        DEFAULT_RATE_NGN_PER_USDC,
    );

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new BadRequestException(
        'Invalid ONRAMP_NGN_USDC_RATE configuration',
      );
    }

    return rate;
  }

  private getSpreadPercent(): number {
    return Number(
      this.configService.get<string>('ONRAMP_SPREAD_PERCENT') ??
        DEFAULT_SPREAD_PERCENT,
    );
  }

  private getPaymentDeadlineMinutes(): number {
    return Number(
      this.configService.get<string>('ONRAMP_PAYMENT_DEADLINE_MINUTES') ??
        DEFAULT_PAYMENT_DEADLINE_MINUTES,
    );
  }

  private getAmountToleranceNgn(): number {
    return Number(
      this.configService.get<string>('ONRAMP_AMOUNT_TOLERANCE_NGN') ??
        DEFAULT_AMOUNT_TOLERANCE_NGN,
    );
  }

  private generateReference(): string {
    return `ONRAMP-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
  }

  private extractReference(payload: HandleWebhookPayload): string | null {
    const directRef = payload.data?.tx_ref;
    if (typeof directRef === 'string' && directRef.startsWith('ONRAMP-')) {
      return directRef;
    }

    const narration = payload.data?.narration;
    if (typeof narration === 'string') {
      const match = narration.match(/ONRAMP-[A-Z0-9]{16}/);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  private async creditUsdc(order: OnRampOrder): Promise<string> {
    this.logger.log(
      `Crediting USDC for order ${order.reference} amount=${order.amountUsdc} userId=${order.userId}`,
    );

    try {
      // Call SorobanService to deposit USDC to user's wallet
      const txHash = await this.sorobanService.deposit(order.userId, Number(order.amountUsdc));
      
      // Create transaction record
      const transaction = this.transactionRepo.create({
        userId: order.userId,
        type: TransactionType.DEPOSIT,
        amount: order.amountUsdc,
        currency: 'USDC',
        status: 'completed',
        reference: order.reference,
        blockchainTxHash: txHash,
        metadata: {
          onrampOrderId: order.id,
          amountNgn: order.amountNgn,
          rateNgnPerUsdc: order.rateNgnPerUsdc,
          spreadPercent: order.spreadPercent,
        },
      });

      await this.transactionRepo.save(transaction);
      
      this.logger.log(
        `Successfully credited USDC for order ${order.reference}, txHash: ${txHash}`,
      );

      return txHash;
    } catch (error) {
      this.logger.error(
        `Failed to credit USDC for order ${order.reference}:`,
        error,
      );
      throw error;
    }
  }

  private roundCurrency(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }
}
