import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { UploadService, UPLOAD_QUEUE, CLEANUP_JOB } from './upload.service';

@Processor(UPLOAD_QUEUE)
export class UploadProcessor {
  private readonly logger = new Logger(UploadProcessor.name);

  constructor(private readonly uploadService: UploadService) {}

  @Process(CLEANUP_JOB)
  async handleCleanup(_job: Job): Promise<void> {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    await this.uploadService.deleteUnconfirmedOlderThan(cutoff);
    this.logger.log(`Cleaned up unconfirmed uploads older than ${cutoff.toISOString()}`);
  }
}
