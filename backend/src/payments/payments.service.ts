import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

@Injectable()
export class PaymentsService {
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
