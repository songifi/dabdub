import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import {
  COMPLIANCE_QUEUE,
  ComplianceDashboardService,
  STRUCTURING_DETECT_JOB,
} from './compliance.service';

@Processor(COMPLIANCE_QUEUE)
export class ComplianceProcessor {
  private readonly logger = new Logger(ComplianceProcessor.name);

  constructor(
    private readonly complianceService: ComplianceDashboardService,
  ) {}

  @Process(STRUCTURING_DETECT_JOB)
  async handleStructuringDetection(_job: Job): Promise<void> {
    const created = await this.complianceService.detectStructuringForYesterday();
    this.logger.log(`Structuring detection created ${created.length} event(s)`);
  }
}
