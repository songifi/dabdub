import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { StellarService } from '../stellar/stellar.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MerchantsService } from '../merchants/merchants.service';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { SorobanService, PaymentExpiredError } from '../blockchain-wallet/soroban.service';

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
    private soroban: SorobanService,
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

    const saved = await this.paymentsRepo.save(payment);

    // Register in Soroban contract with ledger-based expiry.
    // expiryLedgers defaults to 360 (≈ 30 min at 1 ledger/5 s).
    const expiryLedgers = (dto.expiryMinutes ?? 30) * SorobanService.LEDGERS_PER_MINUTE;
    const contractPayment = this.soroban.createPayment(
      saved.id,
      depositAddress,
      '0', // amountUsdc populated on confirmation
      expiryLedgers,
    );

    // Persist the expiry_ledger so NestJS cron can query it without RPC calls.
    saved.expiryLedger = contractPayment.expiryLedger;
    return this.paymentsRepo.save(saved);
  }

  /**
   * Confirm a payment — delegates to the Soroban contract which enforces
   * ledger-based expiry. Throws PaymentExpiredError (→ 410) if the payment
   * window has passed, regardless of NestJS state.
   */
  async confirmPayment(
    paymentId: string,
    customerAddress: string,
  ): Promise<Payment> {
    const payment = await this.paymentsRepo.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');

    // Contract enforces expiry — this throws PaymentExpiredError if expired.
    try {
      await this.soroban.confirm(paymentId, customerAddress);
    } catch (err) {
      if (err instanceof PaymentExpiredError) {
        // Sync NestJS state with contract state
        payment.status = PaymentStatus.EXPIRED;
        await this.paymentsRepo.save(payment);
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    payment.status = PaymentStatus.CONFIRMED;
    payment.customerWalletAddress = customerAddress;
    payment.confirmedAt = new Date();
    return this.paymentsRepo.save(payment);
  }

  /**
   * expire_payment(id) — called by the NestJS cron job.
   * Delegates to the Soroban contract which checks ledger sequence.
   * Emits PaymentExpired event with refund instructions.
   * Idempotent — safe to call on already-expired payments.
   */
  async expirePayment(paymentId: string): Promise<void> {
    const payment = await this.paymentsRepo.findOne({ where: { id: paymentId } });
    if (!payment) return;

    const event = await this.soroban.expirePayment(paymentId);
    if (!event) return; // already expired or not yet due

    payment.status = PaymentStatus.EXPIRED;
    await this.paymentsRepo.save(payment);

    await this.webhooks.dispatch(payment.merchantId, 'payment.expired', {
      paymentId: payment.id,
      reference: payment.reference,
      expiryLedger: event.expiryLedger,
      ledgerAtExpiry: event.ledgerAtExpiry,
      refundInstruction: event.refundInstruction,
    });

    this.logger.warn(
      `Payment ${payment.reference} expired at ledger ${event.expiryLedger}`,
    );
  }

  /**
   * Cron entry point — scans all pending payments whose expiryLedger has
   * passed and expires them via the contract.
   */
  async expirePendingPayments(): Promise<void> {
    const currentLedger = this.soroban.getCurrentLedger();

    const expired = await this.paymentsRepo
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: PaymentStatus.PENDING })
      .andWhere('payment.expiryLedger IS NOT NULL')
      .andWhere('payment.expiryLedger < :currentLedger', { currentLedger })
      .getMany();

    for (const payment of expired) {
      await this.expirePayment(payment.id);
    }

    if (expired.length) {
      this.logger.log(`Expired ${expired.length} payments at ledger ${currentLedger}`);
    }
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
