import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { DataRetentionPolicy } from '../entities/data-retention-policy.entity';

@Injectable()
export class DataPurgeService {
  private readonly logger = new Logger(DataPurgeService.name);
  private readonly TRANSACTION_MIN_RETENTION_DAYS = 2555; // 7 years

  constructor(
    @InjectRepository(DataRetentionPolicy)
    private readonly policyRepo: Repository<DataRetentionPolicy>,
  ) {}

  async estimateRowsToDelete(dataType: string): Promise<number> {
    const policy = await this.policyRepo.findOne({ where: { dataType } });
    if (!policy || !policy.isEnabled) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    // Estimate based on data type
    switch (dataType) {
      case 'audit_logs':
        return this.estimateAuditLogs(cutoffDate);
      case 'webhook_deliveries':
        return this.estimateWebhookDeliveries(cutoffDate);
      default:
        return 0;
    }
  }

  private async estimateAuditLogs(cutoffDate: Date): Promise<number> {
    // Placeholder - implement actual count query
    return 0;
  }

  private async estimateWebhookDeliveries(cutoffDate: Date): Promise<number> {
    // Placeholder - implement actual count query
    return 0;
  }

  async purgeData(dataType: string): Promise<number> {
    const policy = await this.policyRepo.findOne({ where: { dataType } });
    if (!policy || !policy.isEnabled) {
      throw new Error('Policy not found or disabled');
    }

    // Prevent deletion of transaction records within regulatory minimum
    if (
      dataType === 'transaction_records' &&
      policy.retentionDays < this.TRANSACTION_MIN_RETENTION_DAYS
    ) {
      throw new Error(
        `Transaction records must be retained for at least ${this.TRANSACTION_MIN_RETENTION_DAYS} days`,
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    let deletedCount = 0;

    if (policy.archiveBeforeDelete) {
      deletedCount = await this.archiveAndDelete(dataType, cutoffDate);
    } else {
      deletedCount = await this.directDelete(dataType, cutoffDate);
    }

    this.logger.log(
      `Purged ${deletedCount} records from ${dataType} older than ${cutoffDate.toISOString()}`,
    );

    return deletedCount;
  }

  private async archiveAndDelete(
    dataType: string,
    cutoffDate: Date,
  ): Promise<number> {
    // Implement archival to cold storage before deletion
    this.logger.log(`Archiving ${dataType} before deletion`);
    return this.directDelete(dataType, cutoffDate);
  }

  private async directDelete(
    dataType: string,
    cutoffDate: Date,
  ): Promise<number> {
    // Implement actual deletion logic per data type
    return 0;
  }
}
