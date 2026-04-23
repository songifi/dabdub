import { Process, Processor } from '@nestjs/bull';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import type { Job } from 'bull';
import { DEFAULT_QUEUE_JOB, QUEUE_NAMES } from './queue.constants';
import { StellarMonitorService } from '../stellar/stellar-monitor.service';

interface QueueDispatchPayload {
  type?: string;
  payload?: Record<string, unknown>;
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
  constructor() {
    super(SettlementQueueProcessor.name);
  }

  @Process(DEFAULT_QUEUE_JOB)
  handle(job: Job<QueueDispatchPayload>): void {
    this.logJob(job);
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
