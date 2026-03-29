import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bull';
import { RECONCILE_JOB } from './offramp.processor';

@Injectable()
export class OffRampScheduler {
  private readonly logger = new Logger(OffRampScheduler.name);

  constructor(
    @InjectQueue('offramp-jobs')
    private readonly offrampQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduleReconciliation(): Promise<void> {
    this.logger.log('Enqueuing off-ramp reconciliation job');
    await this.offrampQueue.add(
      RECONCILE_JOB,
      {},
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: { count: 100 },
      },
    );
  }
}
