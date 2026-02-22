import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { DataPurgeService } from '../services/data-purge.service';
import { DataRetentionService } from '../services/data-retention.service';

@Processor('data-purge')
export class DataPurgeProcessor {
  private readonly logger = new Logger(DataPurgeProcessor.name);

  constructor(
    private readonly purgeService: DataPurgeService,
    private readonly retentionService: DataRetentionService,
  ) {}

  @Process('purge-data')
  async handlePurge(job: Job<{ dataType: string }>) {
    const { dataType } = job.data;

    this.logger.log(`Starting purge job for ${dataType}`);

    try {
      const deletedCount = await this.purgeService.purgeData(dataType);

      await this.retentionService.updatePurgeStats(dataType, deletedCount);

      this.logger.log(`Purge job completed for ${dataType}: ${deletedCount} records deleted`);

      return { success: true, deletedCount };
    } catch (error) {
      this.logger.error(`Purge job failed for ${dataType}:`, error);
      throw error;
    }
  }
}
