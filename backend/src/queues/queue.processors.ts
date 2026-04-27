import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import type { Job } from 'bull';
import { DEFAULT_QUEUE_JOB, QUEUE_NAMES } from './queue.constants';
import { StellarMonitorService } from '../stellar/stellar-monitor.service';
import { SettlementsService } from '../settlements/settlements.service';
import { CacheService } from '../cache/cache.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settlement } from '../settlements/entities/settlement.entity';

interface QueueDispatchPayload {
  type?: string;
  payload?: Record<string, unknown>;
  settlementId?: string;
  paymentId?: string;
}

abstract class BaseQueueProcessor {
  protected readonly logger: Logger;

  protected constructor(name: string) {
    this.logger = new Logger(name);
  }

  protected logJob(job: Job<QueueDispatchPayload>): void {
    this.logger.debug(
      `Processed queue="${job.queue.name}" job="${job.name}" id="${job.id}" type="${job.data?.type ?? 'unknown'}"`,
    );
  }
}

@Processor(QUEUE_NAMES.settlement)
export class SettlementQueueProcessor extends BaseQueueProcessor {
  constructor(
    private readonly settlementsService: SettlementsService,
    private readonly cacheService: CacheService,
    @InjectRepository(Settlement)
    private readonly settlementsRepo: Repository<Settlement>,
  ) {
    super(SettlementQueueProcessor.name);
  }

  @Process(DEFAULT_QUEUE_JOB)
  async handle(job: Job<{ settlementId: string }>): Promise<void> {
    this.logJob(job);
    const { settlementId } = job.data;

    const settlement = await this.settlementsRepo.findOne({
      where: { id: settlementId },
      relations: ['payments'],
    });

    if (!settlement) {
      this.logger.error(`Settlement ${settlementId} not found`);
      return;
    }

    if (!settlement.payments || settlement.payments.length === 0) {
      this.logger.error(`Settlement ${settlementId} has no linked payments`);
      return;
    }

    const lockKey = `lock:settlement:merchant:${settlement.merchantId}`;
    
    // Acquire distributed lock for merchant isolation
    const acquired = await (this.cacheService as any).redis.set(
      `lock:${lockKey}`, 
      'locked', 
      'EX', 
      60, 
      'NX'
    );

    if (!acquired) {
      this.logger.debug(`Concurrency lock active for merchant ${settlement.merchantId}. Retrying.`);
      throw new Error(`Merchant ${settlement.merchantId} is already processing a settlement.`);
    }

    try {
      await this.settlementsService.executeFiatTransfer(settlement);
    } finally {
      await (this.cacheService as any).redis.del(`lock:${lockKey}`);
    }
  }
}

@Processor(QUEUE_NAMES.webhook)
export class WebhookQueueProcessor extends BaseQueueProcessor {
  constructor() {
    super(WebhookQueueProcessor.name);
  }

  @Process(DEFAULT_QUEUE_JOB)
  handle(job: Job<QueueDispatchPayload>): void {
    this.logJob(job);
  }
}

@Processor(QUEUE_NAMES.notification)
export class NotificationQueueProcessor extends BaseQueueProcessor {
  constructor() {
    super(NotificationQueueProcessor.name);
  }

  @Process(DEFAULT_QUEUE_JOB)
  handle(job: Job<QueueDispatchPayload>): void {
    this.logJob(job);
  }
}

@Processor(QUEUE_NAMES.stellarMonitor)
export class StellarMonitorQueueProcessor extends BaseQueueProcessor {
  constructor(
    @Inject(forwardRef(() => StellarMonitorService))
    private readonly stellarMonitor: StellarMonitorService,
  ) {
    super(StellarMonitorQueueProcessor.name);
  }

  @Process('scan')
  async handleScan(job: Job): Promise<void> {
    const start = Date.now();
    this.logger.log(`Stellar monitor job #${job.id} started`);
    await this.stellarMonitor.scanPendingPayments();
    this.logger.log(`Stellar monitor job #${job.id} done in ${Date.now() - start}ms`);
  }

  @Process(DEFAULT_QUEUE_JOB)
  handle(job: Job<QueueDispatchPayload>): void {
    this.logJob(job);
  }
}
