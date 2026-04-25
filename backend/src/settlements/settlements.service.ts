import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, Between } from 'typeorm';
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

export interface PartnerCallbackPayload {
  reference: string;
  status: 'success' | 'failed';
  failureReason?: string;
}

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
  ) {}

  async initiateSettlement(payment: Payment): Promise<void> {
    const feeRate = 0.015;
    const feeUsd = payment.amountUsd * feeRate;
    const netUsd = payment.amountUsd - feeUsd;
    const LARGE_SETTLEMENT_THRESHOLD = 10000;

    const settlement = this.settlementsRepo.create({
      merchantId: payment.merchantId,
      totalAmountUsd: payment.amountUsd,
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
      await this.executeFiatTransfer(saved, payment);
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

  private async executeFiatTransfer(settlement: Settlement, payment: Payment): Promise<void> {
    const partnerUrl = this.config.get('PARTNER_API_URL');
    const partnerKey = this.config.get('PARTNER_API_KEY');

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

      payment.status = PaymentStatus.SETTLED;
      await this.paymentsRepo.save(payment);

      // Invalidate analytics caches impacted by new settled payment.
      await this.cache.delPattern(`analytics:${settlement.merchantId}:*`);
      await this.cache.delPattern('analytics:admin:*');

      await this.webhooks.dispatch(settlement.merchantId, 'payment.settled', {
        paymentId: payment.id,
        settlementId: settlement.id,
        amount: settlement.netAmountUsd,
      });
    } catch (err) {
      this.logger.error(`Settlement failed for ${settlement.id}`, err.message);
      await this.adminAlerts.raise({
        type: AdminAlertType.SETTLEMENT_FAILURE,
        dedupeKey: `settlement:${settlement.id}`,
        message: `Settlement failed for ${settlement.id}: ${err.message}`,
        metadata: {
          merchantId: settlement.merchantId,
          paymentId: payment.id,
        },
        thresholdValue: 1,
      });

      settlement.status = SettlementStatus.FAILED;
      settlement.failureReason = err.message;
      await this.settlementsRepo.save(settlement);

      payment.status = PaymentStatus.FAILED;
      await this.paymentsRepo.save(payment);

      await this.webhooks.dispatch(settlement.merchantId, 'payment.failed', {
        paymentId: payment.id,
        reason: err.message,
      });
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
    });

    if (!settlement) {
      this.logger.warn(`Partner callback for unknown settlement reference: ${payload.reference}`);
      return;
    }

    const payment = await this.paymentsRepo.findOne({
      where: { settlementId: settlement.id },
    });

    if (payload.status === 'success') {
      settlement.status = SettlementStatus.COMPLETED;
      settlement.completedAt = new Date();
      await this.settlementsRepo.save(settlement);

      if (payment) {
        payment.status = PaymentStatus.SETTLED;
        await this.paymentsRepo.save(payment);

        // Invalidate analytics caches impacted by new settled payment.
        await this.cache.delPattern(`analytics:${settlement.merchantId}:*`);
        await this.cache.delPattern('analytics:admin:*');

        await this.webhooks.dispatch(settlement.merchantId, 'payment.settled', {
          paymentId: payment.id,
          settlementId: settlement.id,
          amount: settlement.netAmountUsd,
        });
      }
    } else {
      settlement.status = SettlementStatus.FAILED;
      settlement.failureReason = payload.failureReason ?? 'Partner reported failure';
      await this.settlementsRepo.save(settlement);

      if (payment) {
        payment.status = PaymentStatus.FAILED;
        await this.paymentsRepo.save(payment);
        await this.webhooks.dispatch(settlement.merchantId, 'payment.failed', {
          paymentId: payment.id,
          reason: settlement.failureReason,
        });
      }
    }
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
      await this.executeFiatTransfer(settlement, settlement.payments[0]);
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
      await this.executeFiatTransfer(settlement, settlement.payments[0]);
    }

    this.logger.log(`Large settlement ${id} approved and processed by admin`);
    return { success: true, message: 'Settlement approved and processing initiated' };
  }