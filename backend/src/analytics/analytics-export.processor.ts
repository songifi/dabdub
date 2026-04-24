import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import {
  ANALYTICS_EXPORT_QUEUE,
  AnalyticsExportService,
} from './analytics-export.service';

@Processor(ANALYTICS_EXPORT_QUEUE)
export class AnalyticsExportProcessor {
  private readonly logger = new Logger(AnalyticsExportProcessor.name);

  constructor(private readonly analyticsExportService: AnalyticsExportService) {}

  @Process('generate')
  async handleGenerate(job: Job<{ exportId: string }>): Promise<void> {
    this.logger.log(`Generating analytics export ${job.data.exportId}`);
    await this.analyticsExportService.generateExport(job.data.exportId);
  }
}
