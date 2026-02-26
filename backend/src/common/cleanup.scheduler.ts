import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const RETENTION_DAYS = 90;

/**
 * Scheduled job to permanently remove (hard delete) soft-deleted splits and participants
 * whose deleted_at is older than RETENTION_DAYS. Runs daily at 3 AM UTC.
 */
@Injectable()
export class CleanupScheduler {
  private readonly logger = new Logger(CleanupScheduler.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async hardDeleteExpiredSoftDeletes(): Promise<void> {
    this.logger.log('Starting soft-delete cleanup job (hard delete after 90 days)...');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
    const cutoffIso = cutoff.toISOString();

    try {
      const participantResult = await this.dataSource
        .createQueryBuilder()
        .delete()
        .from('participants')
        .where('deleted_at IS NOT NULL AND deleted_at < :cutoff', {
          cutoff: cutoffIso,
        })
        .execute();

      const splitResult = await this.dataSource
        .createQueryBuilder()
        .delete()
        .from('splits')
        .where('deleted_at IS NOT NULL AND deleted_at < :cutoff', {
          cutoff: cutoffIso,
        })
        .execute();

      const participantsRemoved = participantResult.affected ?? 0;
      const splitsRemoved = splitResult.affected ?? 0;

      if (participantsRemoved > 0 || splitsRemoved > 0) {
        this.logger.log(
          `Cleanup complete: ${splitsRemoved} splits and ${participantsRemoved} participants hard-deleted (deleted_at < ${cutoffIso})`,
        );
      } else {
        this.logger.log('Cleanup complete: no expired soft-deleted records to remove.');
      }
    } catch (error) {
      this.logger.error('Cleanup job failed', error);
      throw error;
    }
  }
}
