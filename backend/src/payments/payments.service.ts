import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { BatchCreatePaymentDto, BatchPaymentResultDto } from './dto/batch-create-payment.dto';
import { StellarService } from '../stellar/stellar.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MerchantsService } from '../merchants/merchants.service';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';

// Events emitted per payment in a batch — mirrors contract PaymentCreated events
export interface PaymentCreatedEvent {
  type: 'PaymentCreated';
  paymentId: string;
  merchantId: string;
  amountUsd: number;
  memo: string;
  timestamp: Date;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
    private stellar: StellarService,
    private webhooks: WebhooksService,
    private notifications: NotificationsService,
    private merchants: MerchantsService,
  ) {}

  async create(merchantId: string, dto: CreatePaymentDto): Promise<Payment> {
    const xlmRate = await this.stellar.getXlmUsdRate();
    const amountXlm = dto.amountUsd / xlmRate;

    const memo = this.stellar.generateMemo();
    const depositAddress = this.stellar.getDepositAddress();

    const stellarUri = `web+stellar:pay?destination=${depositAddress}&amount=${amountXlm.toFixed(7)}&memo=${memo}&memo_type=text`;
    const qrCode = await QRCode.toDataURL(stellarUri);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + (dto.expiryMinutes ?? 30));

    const payment = this.paymentsRepo.create({
      id: uuidv4(),
      reference: `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      merchantId,
      amountUsd: dto.amountUsd,
      amountXlm: parseFloat(amountXlm.toFixed(7)),
      description: dto.description,
      customerEmail: dto.customerEmail,
      metadata: dto.metadata,
      stellarDepositAddress: depositAddress,
      stellarMemo: memo,
      qrCode,
      expiresAt,
      status: PaymentStatus.PENDING,
    });

    return this.paymentsRepo.save(payment);
  }

  /**
   * create_batch — mirrors the Soroban contract's create_batch(payments: Vec<PaymentInput>).
   *
   * Creates up to 20 payment requests atomically. Validates every entry first
   * so the entire batch reverts (throws) if any single input is invalid —
   * no partial writes ever reach the database.
   *
   * Emits a PaymentCreated event for each entry, matching the contract event log.
   */
  async createBatch(
    merchantId: string,
    dto: BatchCreatePaymentDto,
  ): Promise<BatchPaymentResultDto> {
    const { payments: items } = dto;

    // ── Validate all inputs before touching the DB (atomic revert on failure) ──
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.amountUsd || item.amountUsd <= 0) {
        throw new BadRequestException(
          `Batch item [${i}]: amountUsd must be greater than 0`,
        );
      }
      if (!item.memo || item.memo.trim().length === 0) {
        throw new BadRequestException(
          `Batch item [${i}]: memo must not be empty`,
        );
      }
    }

    // ── Build all payment records in memory ───────────────────────────────────
    const xlmRate = await this.stellar.getXlmUsdRate();
    const depositAddress = this.stellar.getDepositAddress();
    const now = Date.now();

    const records: Payment[] = [];
    const events: PaymentCreatedEvent[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const amountXlm = item.amountUsd / xlmRate;
      const memo = this.stellar.generateMemo();

      const stellarUri =
        `web+stellar:pay?destination=${depositAddress}` +
        `&amount=${amountXlm.toFixed(7)}&memo=${memo}&memo_type=text`;
      const qrCode = await QRCode.toDataURL(stellarUri);

      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + (item.expiryMinutes ?? 30));

      const payment = this.paymentsRepo.create({
        id: uuidv4(),
        // Unique reference per item — suffix with batch index to avoid collisions
        reference: `PAY-${now}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-B${i}`,
        merchantId,
        amountUsd: item.amountUsd,
        amountXlm: parseFloat(amountXlm.toFixed(7)),
        description: item.memo,
        customerEmail: item.customerEmail,
        metadata: item.metadata,
        stellarDepositAddress: depositAddress,
        stellarMemo: memo,
        qrCode,
        expiresAt,
        status: PaymentStatus.PENDING,
      });

      records.push(payment);
      events.push({
        type: 'PaymentCreated',
        paymentId: payment.id,
        merchantId,
        amountUsd: item.amountUsd,
        memo: item.memo,
        timestamp: new Date(),
      });
    }

    // ── Persist all records in one shot (atomic) ──────────────────────────────
    const saved = await this.paymentsRepo.save(records);

    // ── Emit PaymentCreated event for each entry (mirrors contract event log) ─
    for (const event of events) {
      this.logger.log(
        `PaymentCreated: id=${event.paymentId} merchant=${merchantId} amount=${event.amountUsd} memo="${event.memo}"`,
      );
    }

    return {
      paymentIds: saved.map((p) => p.id),
      count: saved.length,
    };
  }

  async findAll(merchantId: string, page = 1, limit = 20) {
    const [data, total] = await this.paymentsRepo.findAndCount({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async findOne(id: string, merchantId: string): Promise<Payment> {
    const payment = await this.paymentsRepo.findOne({ where: { id, merchantId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async findByReference(reference: string): Promise<Payment> {
    const payment = await this.paymentsRepo.findOne({ where: { reference } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async getStats(merchantId: string) {
    const result = await this.paymentsRepo
      .createQueryBuilder('payment')
      .select('payment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(payment.amountUsd)', 'totalUsd')
      .where('payment.merchantId = :merchantId', { merchantId })
      .groupBy('payment.status')
      .getRawMany();

    return result;
  }

  async refund(id: string, merchantId: string, dto: RefundPaymentDto): Promise<Payment> {
    const payment = await this.findOne(id, merchantId);

    if (payment.status !== PaymentStatus.SETTLED) {
      throw new BadRequestException('Only settled payments can be refunded');
    }

    if (!payment.customerWalletAddress) {
      throw new BadRequestException('Customer wallet address is unknown. Manual refund required.');
    }

    const merchant = await this.merchants.findOne(merchantId);

    // Determine refund amount
    const refundAmountUsd = dto.amountUsd || payment.amountUsd;
    if (refundAmountUsd > payment.amountUsd) {
      throw new BadRequestException('Refund amount cannot exceed original payment amount');
    }

    // Determine asset and amount for Stellar transfer
    let asset: StellarSdk.Asset;
    let amountStr: string;

    if (payment.amountUsdc) {
      asset = this.stellar.getUsdcAsset();
      // If partial refund, we need to calculate USDC amount based on ratio
      const ratio = refundAmountUsd / payment.amountUsd;
      const amountUsdc = payment.amountUsdc * ratio;
      amountStr = amountUsdc.toFixed(7);
    } else {
      asset = StellarSdk.Asset.native();
      const ratio = refundAmountUsd / payment.amountUsd;
      const amountXlm = payment.amountXlm * ratio;
      amountStr = amountXlm.toFixed(7);
    }

    const memo = `REFUND-${payment.reference.split('-').pop()}`;

    try {
      const txHash = await this.stellar.sendPayment(
        payment.customerWalletAddress,
        amountStr,
        asset,
        memo,
      );

      payment.status = PaymentStatus.REFUNDED;
      payment.refundAmountUsd = refundAmountUsd;
      payment.refundReason = dto.reason;
      payment.refundTxHash = txHash;
      payment.refundedAt = new Date();

      const saved = await this.paymentsRepo.save(payment);

      // Dispatch webhook
      await this.webhooks.dispatch(merchantId, 'payment.refunded', {
        paymentId: payment.id,
        reference: payment.reference,
        refundAmountUsd,
        refundTxHash: txHash,
        reason: dto.reason,
      });

      // Send emails
      await this.notifications.enqueueEmail({
        recipient: merchant.email,
        subject: `Refund processed: ${payment.reference}`,
        html: `<p>A refund of $${refundAmountUsd} has been processed for payment ${payment.reference}.</p><p>Reason: ${dto.reason}</p>`,
      });

      if (payment.customerEmail) {
        await this.notifications.enqueueEmail({
          recipient: payment.customerEmail,
          subject: `Refund received from ${merchant.businessName}`,
          html: `<p>A refund of $${refundAmountUsd} has been processed for your payment ${payment.reference}.</p><p>The funds have been sent back to your Stellar wallet.</p>`,
        });
      }

      return saved;
    } catch (err) {
      throw new BadRequestException(`Stellar refund failed: ${err.message}`);
    }
  }
}
