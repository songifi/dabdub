import { Inject, Injectable, Logger } from '@nestjs/common';
import { SettlementRepository } from './repositories/settlement.repository';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Settlement,
  SettlementStatus,
  SettlementProvider,
} from './entities/settlement.entity';
import { IPartnerService } from './interfaces/partner-service.interface';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { SettlementGenericFilterDto } from './dto/settlement-filter.dto';
import { SettlementPreferencesDto } from './dto/settlement-preferences.dto';
import { BatchSettlementDto } from './dto/batch-settlement.dto';
import {
  FindManyOptions,
  In,
  Repository,
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { SettlementStatsDto } from './dto/settlement-response.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Merchant } from '../database/entities/merchant.entity';
import { randomUUID } from 'crypto';

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly settlementRepository: SettlementRepository,
    @Inject('IPartnerService')
    private readonly partnerService: IPartnerService,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
  ) {}

  /**
   * Create a new settlement request
   */
  async createSettlement(data: CreateSettlementDto): Promise<Settlement> {
    const exchangeRate = await this.partnerService.getExchangeRate(
      data.sourceCurrency,
      data.currency,
    );

    const feePercentage = 0.01; // 1% fee
    const feeAmount = data.amount * feePercentage;
    const netAmount = data.amount - feeAmount;

    return this.settlementRepository.create({
      paymentRequestId: data.paymentRequestId,
      merchantId: data.merchantId,
      amount: data.amount,
      currency: data.currency,
      sourceCurrency: data.sourceCurrency,
      exchangeRate,
      feeAmount,
      feePercentage,
      netAmount,
      bankAccountNumber: data.bankDetails.accountNumber,
      bankRoutingNumber: data.bankDetails.routingNumber,
      bankAccountHolderName: data.bankDetails.name,
      bankName: data.bankDetails.bankName,
      status: SettlementStatus.PENDING,
      provider: SettlementProvider.BANK_API, // Default to generic bank API
    });
  }

  async findAll(
    merchantId: string,
    filter: SettlementGenericFilterDto,
  ): Promise<{
    data: Settlement[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      status,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filter;

    const where: any = { merchantId };

    if (status) {
      where.status = status;
    }

    if (fromDate && toDate) {
      where.createdAt = Between(new Date(fromDate), new Date(toDate));
    } else if (fromDate) {
      where.createdAt = MoreThanOrEqual(new Date(fromDate));
    } else if (toDate) {
      where.createdAt = LessThanOrEqual(new Date(toDate));
    }

    const [data, total] = await this.settlementRepository.findWithPagination({
      where,
      order: { [sortBy]: sortOrder.toUpperCase() },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findOne(id: string, merchantId: string): Promise<Settlement> {
    const settlement = await this.settlementRepository.findOne(id);
    if (!settlement || settlement.merchantId !== merchantId) {
      throw new Error('Settlement not found');
    }
    return settlement;
  }

  async findPending(merchantId: string): Promise<Settlement[]> {
    return this.settlementRepository.findByMerchantAndStatus(
      merchantId,
      SettlementStatus.PENDING,
    );
  }

  async getStatistics(merchantId: string): Promise<SettlementStatsDto> {
    return this.settlementRepository.getSettlementStats(merchantId);
  }

  async generateReceipt(id: string, merchantId: string): Promise<any> {
    const settlement = await this.findOne(id, merchantId);
    if (settlement.status !== SettlementStatus.COMPLETED) {
      throw new Error('Receipt not available for incomplete settlements');
    }
    return {
      receiptId: settlement.settlementReceipt,
      amount: settlement.amount,
      currency: settlement.currency,
      date: settlement.settledAt,
      merchantId: settlement.merchantId,
      status: settlement.status,
    };
  }

  async createBatch(
    merchantId: string,
    batchDto: BatchSettlementDto,
  ): Promise<void> {
    const settlements = await this.settlementRepository.findByIds(
      batchDto.settlementIds,
    );

    // Validate ownership and status
    for (const settlement of settlements) {
      if (settlement.merchantId !== merchantId) {
        throw new Error(
          `Settlement ${settlement.id} does not belong to merchant`,
        );
      }
      if (settlement.status !== SettlementStatus.PENDING) {
        throw new Error(`Settlement ${settlement.id} is not pending`);
      }
    }

    // Trigger processing (simplified for now, ideally queue them)
    // In a real system, we might group them into a batch entity
    const batchId = randomUUID();
    await this.settlementRepository.updateBatch(batchDto.settlementIds, {
      batchId,
      status: SettlementStatus.PROCESSING,
      processedAt: new Date(),
    });

    // Async processing could be triggered here or picked up by cron
    // For manual batch, we might want to process immediately or let the cron pick it up if status is PENDING.
    // However, we set to PROCESSING, so cron might skip it unless we handle it.
    // Let's set back to PENDING but with a batchId so cron picks it up?
    // Or just call processSingleSettlement for each.

    // For this implementation, let's process them immediately in background
    for (const settlement of settlements) {
      this.processSingleSettlement(settlement).catch((err) =>
        this.logger.error(
          `Error processing batch settlement ${settlement.id}`,
          err,
        ),
      );
    }
  }

  async getSchedule(merchantId: string): Promise<any> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });
    if (!merchant) {
      throw new Error('Merchant not found');
    }
    return merchant.settings?.settlementSchedule || { schedule: 'daily' };
  }

  async updatePreferences(
    merchantId: string,
    preferences: SettlementPreferencesDto,
  ): Promise<any> {
    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });
    if (!merchant) {
      throw new Error('Merchant not found');
    }

    merchant.settings = {
      ...merchant.settings,
      settlementSchedule: preferences,
    };

    await this.merchantRepository.save(merchant);
    return merchant.settings.settlementSchedule;
  }

  async getHistory(
    merchantId: string,
    filter: SettlementGenericFilterDto,
  ): Promise<{
    data: Settlement[];
    total: number;
    page: number;
    limit: number;
  }> {
    // Reuse findAll but ensure we only get past settlements if needed?
    // Actually findAll is generic enough.
    return this.findAll(merchantId, filter);
  }

  /**
   * Cron job to process pending settlements
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processSettlements() {
    this.logger.log('Starting settlement batch processing...');

    const pendingSettlements =
      await this.settlementRepository.findPendingSettlements(50);

    if (pendingSettlements.length === 0) {
      this.logger.log('No pending settlements found.');
      return;
    }

    this.logger.log(`Found ${pendingSettlements.length} pending settlements.`);

    // Mark all as processing first
    const settlementIds = pendingSettlements.map((s) => s.id);
    await this.settlementRepository.updateBatch(settlementIds, {
      status: SettlementStatus.PROCESSING,
      processedAt: new Date(),
    });

    for (const settlement of pendingSettlements) {
      await this.processSingleSettlement(settlement);
    }

    this.logger.log('Batch processing completed.');
  }

  private async processSingleSettlement(settlement: Settlement) {
    try {
      const result = await this.partnerService.executeTransfer(
        settlement.netAmount,
        settlement.currency,
        {
          accountNumber: settlement.bankAccountNumber,
          routingNumber: settlement.bankRoutingNumber,
          name: settlement.bankAccountHolderName,
        },
      );

      if (result.success) {
        await this.settlementRepository.updateStatus(
          settlement.id,
          SettlementStatus.COMPLETED,
          {
            settlementReference: result.transactionId,
            settlementReceipt: `RCPT-${result.transactionId}`,
            providerReference: result.transactionId,
          },
        );
        this.logger.log(`Settlement ${settlement.id} completed successfully.`);
      } else {
        await this.handleSettlementFailure(
          settlement,
          result.error || 'Unknown error',
        );
      }
    } catch (error) {
      this.logger.error(`Error processing settlement ${settlement.id}:`, error);
      await this.handleSettlementFailure(settlement, (error as any).message);
    }
  }

  private async handleSettlementFailure(
    settlement: Settlement,
    reason: string,
  ) {
    const newRetryCount = settlement.retryCount + 1;
    const status =
      newRetryCount >= settlement.maxRetries
        ? SettlementStatus.FAILED
        : SettlementStatus.PENDING; // Set back to pending for retry in next batch

    await this.settlementRepository.update(settlement.id, {
      status,
      retryCount: newRetryCount,
      failureReason: reason,
    });

    this.logger.warn(
      `Settlement ${settlement.id} failed (Attempt ${newRetryCount}/${settlement.maxRetries}). Reason: ${reason}. New Status: ${status}`,
    );
  }
}
