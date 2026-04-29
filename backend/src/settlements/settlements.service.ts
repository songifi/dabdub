import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES, DEFAULT_QUEUE_JOB } from '../queues/queue.constants';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between, IsNull, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AdminAlertService } from '../alerts/admin-alert.service';
import { AdminAlertType } from '../alerts/admin-alert.entity';
import { Settlement, SettlementStatus } from './entities/settlement.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { WebhooksService } from '../webhooks/webhooks.service';
import { PaginatedResponseDto } from '../common/dto/pagination.dto';
import { AdminSettlementsQueryDto } from './dto/admin-settlements-query.dto';
import { CacheService } from '../cache/cache.service';
import { EmailService } from '../email/email.service';
import { MerchantsService } from '../merchants/merchants.service';
import { NotificationPrefsService } from '../notifications/notification-prefs.service';
import { NotificationChannel, NotificationEventType } from '../notifications/entities/notification-preference.entity';
import { StellarService } from '../stellar/stellar.service';

export interface PartnerCallbackPayload {
  reference: string;
  status: 'success' | 'failed';
  failureReason?: string;
}

const SMALL_BATCH_THRESHOLD_USD = 10;
const MAX_BATCH_PAYMENT_COUNT = 50;
const BATCH_WINDOW_MINUTES = 15;
const BATCH_FEE_RATE = 0.015;

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);

  constructor(
    @InjectRepository(Settlement)
    private settlementsRepo: Repository<Settlement>,
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
    private config: ConfigService,
    private webhooks: WebhooksService,
    private adminAlerts: AdminAlertService,
    private cache: CacheService,
    private emailService: EmailService,
    private merchantsService: MerchantsService,
    private notificationPrefs: NotificationPrefsService,
    @Inject(forwardRef(() => StellarService))
    private stellar: StellarService,
    @InjectQueue(QUEUE_NAMES.settlement)
    private settlementQueue: Queue,
  ) {}

  private async invalidateAnalyticsForMerchant(merchantId: string): Promise<void> {
    await this.cache.delPattern(`analytics:${merchantId}:*`);
    await this.cache.delPattern('analytics:admin:*');
  }

  async initiateSettlement(payment: Payment): Promise<void> {
    const amountUsd = Number(payment.amountUsd);
    if (amountUsd < SMALL_BATCH_THRESHOLD_USD) {
      this.logger.debug(
        `Payment ${payment.id} below ${SMALL_BATCH_THRESHOLD_USD} USD batch threshold; waiting for batch window.`,
      );
      return;
    }

    const feeUsd = amountUsd * BATCH_FEE_RATE;
    const netUsd = amountUsd - feeUsd;
    const LARGE_SETTLEMENT_THRESHOLD = 10000;

    const settlement = this.settlementsRepo.create({
      merchantId: payment.merchantId,
      totalAmountUsd: amountUsd,
      feeAmountUsd: feeUsd,
      netAmountUsd: netUsd,
      fiatCurrency: 'NGN',
      status: netUsd >= LARGE_SETTLEMENT_THRESHOLD ? SettlementStatus.PENDING_APPROVAL : SettlementStatus.PROCESSING,
      requiresApproval: netUsd >= LARGE_SETTLEMENT_THRESHOLD,
    });

    const saved = await this.settlementsRepo.save(settlement);

    payment.status = PaymentStatus.SETTLING;
    payment.feeUsd = feeUsd;
    payment.settlementId = saved.id;
    await this.paymentsRepo.save(payment);

    await this.webhooks.dispatch(payment.merchantId, 'payment.settling', {
      paymentId: payment.id,
      settlementId: saved.id,
    });

    // Only execute transfer if no approval required
    if (!settlement.requiresApproval) {
      this.logger.debug(`Enqueuing settlement job for ${saved.id}`);
      await this.enqueueSettlement(saved.id);
    } else {
      // Alert admin about large settlement requiring approval
      await this.adminAlerts.raise({
        type: AdminAlertType.SETTLEMENT_FAILURE, // Reusing existing type for now
        dedupeKey: `large-settlement:${saved.id}`,
        message: `Large settlement ${saved.id} requires manual approval: $${netUsd.toFixed(2)}`,
        metadata: {
          merchantId: saved.merchantId,
          paymentId: payment.id,
          amount: netUsd,
        },
        thresholdValue: 1,
      });
    }
  }

  private async enqueueSettlement(settlementId: string): Promise<void> {
    await this.settlementQueue.add(DEFAULT_QUEUE_JOB, { settlementId });
  }

  @Cron('0 */15 * * * *')
  async batchSmallConfirmedPayments(): Promise<void> {
    const confirmedPayments = await this.paymentsRepo.find({
      where: {
        status: PaymentStatus.CONFIRMED,
        settlementId: IsNull(),
        amountUsd: LessThan(SMALL_BATCH_THRESHOLD_USD),
      },
      order: {
        merchantId: 'ASC',
        confirmedAt: 'ASC',
        createdAt: 'ASC',
      },
    });

    if (confirmedPayments.length === 0) {
      return;
    }

    const groups = new Map<string, Payment[]>();
    for (const payment of confirmedPayments) {
      const list = groups.get(payment.merchantId) ?? [];
      list.push(payment);
      groups.set(payment.merchantId, list);
    }

    for (const payments of groups.values()) {
      await this.flushMerchantBatch(payments);
    }
  }

  private async flushMerchantBatch(payments: Payment[]): Promise<void> {
    const ordered = [...payments].sort(
      (a, b) =>
        new Date(a.confirmedAt ?? a.createdAt).getTime() -
        new Date(b.confirmedAt ?? b.createdAt).getTime(),
    );

    let batch: Payment[] = [];
    let runningTotal = 0;

    for (const payment of ordered) {
      batch.push(payment);
      runningTotal += Number(payment.amountUsd);

      const oldest = batch[0];
      const oldestAt = new Date(oldest.confirmedAt ?? oldest.createdAt).getTime();
      const isOldEnough = Date.now() - oldestAt >= BATCH_WINDOW_MINUTES * 60 * 1000;
      const shouldFlush =
        runningTotal >= SMALL_BATCH_THRESHOLD_USD ||
        batch.length >= MAX_BATCH_PAYMENT_COUNT ||
        isOldEnough;

      if (shouldFlush) {
        await this.createBatchSettlement(batch);
        batch = [];
        runningTotal = 0;
      }
    }
  }

  private async createBatchSettlement(payments: Payment[]): Promise<void> {
    if (payments.length === 0) {
      return;
    }

    const totalAmountUsd = payments.reduce((sum, payment) => sum + Number(payment.amountUsd), 0);
    const feeAmountUsd = totalAmountUsd * BATCH_FEE_RATE;
    const netAmountUsd = totalAmountUsd - feeAmountUsd;

    const settlement = this.settlementsRepo.create({
      merchantId: payments[0].merchantId,
      totalAmountUsd,
      feeAmountUsd,
      netAmountUsd,
      fiatCurrency: 'NGN',
      status: netAmountUsd >= 10000 ? SettlementStatus.PENDING_APPROVAL : SettlementStatus.PROCESSING,
      requiresApproval: netAmountUsd >= 10000,
    });

    const saved = await this.settlementsRepo.save(settlement);

    for (const payment of payments) {
      payment.status = PaymentStatus.SETTLING;
      payment.feeUsd = Number((Number(payment.amountUsd) * BATCH_FEE_RATE).toFixed(6));
      payment.settlementId = saved.id;
      await this.paymentsRepo.save(payment);
    }

    this.logger.debug(
      `Created batch settlement ${saved.id} for merchant ${saved.merchantId} with ${payments.length} payments totaling $${totalAmountUsd.toFixed(2)}`,
    );

    if (saved.status === SettlementStatus.PROCESSING) {
      await this.enqueueSettlement(saved.id);
    } else {
      await this.adminAlerts.raise({
        type: AdminAlertType.SETTLEMENT_FAILURE,
        dedupeKey: `large-settlement:${saved.id}`,
        message: `Batch settlement ${saved.id} requires manual approval: $${netAmountUsd.toFixed(2)}`,
        metadata: {
          merchantId: saved.merchantId,
          paymentCount: payments.length,
          amount: netAmountUsd,
        },
        thresholdValue: 1,
      });
    }
  }

  async executeFiatTransfer(settlement: Settlement): Promise<void> {
    const partnerUrl = this.config.get('PARTNER_API_URL');
    const partnerKey = this.config.get('PARTNER_API_KEY');
    const payments = settlement.payments ?? [];

    if (payments.length === 0) {
      throw new Error(`Settlement ${settlement.id} has no linked payments`);
    }

    try {
      const response = await axios.post(
        `${partnerUrl}/transfers`,
        {
          amount: settlement.netAmountUsd,
          currency: 'USD',
          merchantId: settlement.merchantId,
          reference: settlement.id,
        },
        { headers: { Authorization: `Bearer ${partnerKey}` } },
      );

      settlement.status = SettlementStatus.COMPLETED;
      settlement.partnerReference = response.data?.reference;
      settlement.completedAt = new Date();
      await this.settlementsRepo.save(settlement);

      for (const payment of payments) {
        await this.stellar.invokeContract('settle', [payment.id, settlement.id]);
        payment.status = PaymentStatus.SETTLED;
        await this.paymentsRepo.save(payment);
      }

      // Invalidate analytics caches impacted by payment.settled.
      await this.invalidateAnalyticsForMerchant(settlement.merchantId);

      for (const payment of payments) {
        await this.webhooks.dispatch(settlement.merchantId, 'payment.settled', {
          paymentId: payment.id,
          settlementId: settlement.id,
          amount: payment.amountUsd,
        });

        await this.sendSettlementEmail(
          settlement.merchantId,
          NotificationEventType.PAYMENT_SETTLED,
          'settlement-completed',
          {
            settlementId: settlement.id,
            netAmountUsd: Number(settlement.netAmountUsd).toFixed(2),
            paymentId: payment.id,
          },
        );
      }
    } catch (err) {
      this.logger.error(`Settlement failed for ${settlement.id}`, err.message);
      await this.adminAlerts.raise({
        type: AdminAlertType.SETTLEMENT_FAILURE,
        dedupeKey: `settlement:${settlement.id}`,
        message: `Settlement failed for ${settlement.id}: ${err.message}`,
        metadata: {
          merchantId: settlement.merchantId,
          paymentIds: payments.map((payment) => payment.id),
        },
        thresholdValue: 1,
      });

      settlement.status = SettlementStatus.FAILED;
      settlement.failureReason = err.message;
      await this.settlementsRepo.save(settlement);

      for (const payment of payments) {
        payment.status = PaymentStatus.FAILED;
        await this.paymentsRepo.save(payment);
      }

      for (const payment of payments) {
        await this.webhooks.dispatch(settlement.merchantId, 'payment.failed', {
          paymentId: payment.id,
          reason: err.message,
        });

        await this.sendSettlementEmail(
          settlement.merchantId,
          NotificationEventType.SETTLEMENT_FAILED,
          'payment-failed',
          {
            settlementId: settlement.id,
            paymentId: payment.id,
            reason: err.message,
          },
        );
      }
    }
  }

  async findAll(merchantId: string, page = 1, limit = 20) {
    const [data, total] = await this.settlementsRepo.findAndCount({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async handlePartnerCallback(payload: PartnerCallbackPayload): Promise<void> {
    const settlement = await this.settlementsRepo.findOne({
      where: { id: payload.reference },
      relations: ['payments'],
    });

    if (!settlement) {
      this.logger.warn(`Partner callback for unknown settlement reference: ${payload.reference}`);
      return;
    }

    const payments = settlement.payments ?? [];

    if (payload.status === 'success') {
      settlement.status = SettlementStatus.COMPLETED;
      settlement.completedAt = new Date();
      await this.settlementsRepo.save(settlement);

      for (const payment of payments) {
        await this.stellar.invokeContract('settle', [payment.id, settlement.id]);
        payment.status = PaymentStatus.SETTLED;
        await this.paymentsRepo.save(payment);
      }

      // Invalidate analytics caches impacted by payment.settled.
      await this.invalidateAnalyticsForMerchant(settlement.merchantId);

      for (const payment of payments) {
        await this.webhooks.dispatch(settlement.merchantId, 'payment.settled', {
          paymentId: payment.id,
          settlementId: settlement.id,
          amount: payment.amountUsd,
        });

        await this.sendSettlementEmail(
          settlement.merchantId,
          NotificationEventType.PAYMENT_SETTLED,
          'settlement-completed',
          {
            settlementId: settlement.id,
            netAmountUsd: Number(settlement.netAmountUsd).toFixed(2),
            paymentId: payment.id,
          },
        );
      }
    } else {
      settlement.status = SettlementStatus.FAILED;
      settlement.failureReason = payload.failureReason ?? 'Partner reported failure';
      await this.settlementsRepo.save(settlement);

      for (const payment of payments) {
        payment.status = PaymentStatus.FAILED;
        await this.paymentsRepo.save(payment);
      }

      for (const payment of payments) {
        await this.webhooks.dispatch(settlement.merchantId, 'payment.failed', {
          paymentId: payment.id,
          reason: settlement.failureReason,
        });

        await this.sendSettlementEmail(
          settlement.merchantId,
          NotificationEventType.SETTLEMENT_FAILED,
          'payment-failed',
          {
            settlementId: settlement.id,
            paymentId: payment.id,
            reason: settlement.failureReason,
          },
        );
      }
    }
  }

  /**
   * Sends an email for a settlement event only if the merchant has that
   * channel+event combination enabled in their notification preferences.
   */
  private async sendSettlementEmail(
    merchantId: string,
    eventType: NotificationEventType,
    templateAlias: string,
    mergeData: Record<string, unknown>,
  ): Promise<void> {
    const emailEnabled = await this.notificationPrefs.isEnabled(
      merchantId,
      NotificationChannel.EMAIL,
      eventType,
    );
    if (!emailEnabled) return;

    try {
      const merchant = await this.merchantsService.findOne(merchantId);
      await this.emailService.queue(merchant.email, templateAlias, mergeData, merchantId);
    } catch (err) {
      this.logger.warn(`Failed to send settlement email for merchant ${merchantId}: ${err.message}`);
    }
  }

  // Admin methods
  async findAllAdmin(query: AdminSettlementsQueryDto) {
    const { page = 1, limit = 20, status, merchantId, startDate, endDate, partnerReference, bankReference } = query;
    
    const whereConditions: any = {};
    
    if (status) {
      whereConditions.status = status;
    }
    
    if (merchantId) {
      whereConditions.merchantId = merchantId;
    }
    
    if (partnerReference) {
      whereConditions.partnerReference = partnerReference;
    }
    
    if (bankReference) {
      whereConditions.bankReference = bankReference;
    }
    
    if (startDate && endDate) {
      whereConditions.createdAt = Between(new Date(startDate), new Date(endDate));
    } else if (startDate) {
      whereConditions.createdAt = Between(new Date(startDate), new Date());
    } else if (endDate) {
      whereConditions.createdAt = Between(new Date('1970-01-01'), new Date(endDate));
    }

    const options: FindManyOptions<Settlement> = {
      where: whereConditions,
      relations: ['merchant', 'payments'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    };

    const [data, total] = await this.settlementsRepo.findAndCount(options);

    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async retrySettlement(id: string): Promise<{ success: boolean; message: string }> {
    const settlement = await this.settlementsRepo.findOne({
      where: { id },
      relations: ['payments'],
    });

    if (!settlement) {
      return { success: false, message: 'Settlement not found' };
    }

    if (settlement.status !== SettlementStatus.FAILED) {
      return { success: false, message: 'Only failed settlements can be retried' };
    }

    // Reset settlement status and clear failure reason
    settlement.status = SettlementStatus.PROCESSING;
    settlement.failureReason = null;
    settlement.partnerReference = null;
    settlement.completedAt = null;
    await this.settlementsRepo.save(settlement);

    // Update associated payments
    for (const payment of settlement.payments) {
      payment.status = PaymentStatus.SETTLING;
      await this.paymentsRepo.save(payment);
    }

    // Retry the fiat transfer
    if (settlement.payments.length > 0) {
      await this.enqueueSettlement(settlement.id);
    }

    this.logger.log(`Settlement ${id} retry initiated by admin`);
    return { success: true, message: 'Settlement retry initiated' };
  }

  async approveSettlement(id: string): Promise<{ success: boolean; message: string }> {
    const settlement = await this.settlementsRepo.findOne({
      where: { id },
      relations: ['payments'],
    });

    if (!settlement) {
      return { success: false, message: 'Settlement not found' };
    }

    if (settlement.status !== SettlementStatus.PENDING_APPROVAL) {
      return { success: false, message: 'Only settlements pending approval can be approved' };
    }

    if (!settlement.requiresApproval) {
      return { success: false, message: 'Settlement does not require manual approval' };
    }

    // Approve and process the settlement
    settlement.status = SettlementStatus.PROCESSING;
    settlement.approvedAt = new Date();
    settlement.approvedBy = 'admin'; // In a real app, this would be the admin user ID
    await this.settlementsRepo.save(settlement);

    // Update associated payments
    for (const payment of settlement.payments) {
      payment.status = PaymentStatus.SETTLING;
      await this.paymentsRepo.save(payment);
    }

    // Execute the fiat transfer
    if (settlement.payments.length > 0) {
      await this.enqueueSettlement(settlement.id);
    }

    this.logger.log(`Large settlement ${id} approved and processed by admin`);
    return { success: true, message: 'Settlement approved and processing initiated' };
  }
}
