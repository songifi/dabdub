import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { OffRampService } from './offramp.service';

export const RECONCILE_JOB = 'reconcile-offramp';

@Processor('offramp-jobs')
export class OffRampProcessor {
  private readonly logger = new Logger(OffRampProcessor.name);

  constructor(private readonly offRampService: OffRampService) {}

  @Process(RECONCILE_JOB)
  async handleReconcile(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.id}: ${RECONCILE_JOB}`);
    try {
      await this.offRampService.reconcileStaleOrders();
    } catch (err: any) {
      this.logger.error(`Reconciliation job ${job.id} failed: ${err.message}`);
      throw err; // rethrow so BullMQ marks it failed and retries
    }
  }
}
