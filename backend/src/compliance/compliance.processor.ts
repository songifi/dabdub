import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import {
  CHECK_TRANSACTION_JOB,
  COMPLIANCE_QUEUE,
  ComplianceDashboardService,
  STRUCTURING_DETECT_JOB,
  type CheckTransactionJobData,
} from './compliance.service';
import { AmlService } from './aml.service';

@Processor(COMPLIANCE_QUEUE)
export class ComplianceProcessor {
  private readonly logger = new Logger(ComplianceProcessor.name);

  constructor(
    private readonly complianceService: ComplianceDashboardService,
    private readonly amlService: AmlService,
  ) {}

  @Process(STRUCTURING_DETECT_JOB)
  async handleStructuringDetection(_job: Job): Promise<void> {
    const created = await this.complianceService.detectStructuringForYesterday();
    this.logger.log(`Structuring detection created ${created.length} event(s)`);
  }

  @Process(CHECK_TRANSACTION_JOB)
  async handleCheckTransaction(job: Job<CheckTransactionJobData>): Promise<void> {
    const { userId, amount, txId } = job.data;
    const result = await this.amlService.checkTransaction(userId, amount, txId);
    this.logger.log(
      `AML check for user=${userId} amount=${amount}: ${result.events.length} event(s) created, autoFrozen=${result.autoFrozen}`,
    );
  }
}
