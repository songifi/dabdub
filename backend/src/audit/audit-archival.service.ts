import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class AuditArchivalService {
  private readonly logger = new Logger(AuditArchivalService.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async archiveOldLogs(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2);

    try {
      const archived = await this.auditLogService.archiveOlderThan(cutoffDate);
      if (archived > 0) {
        this.logger.log(`Archived ${archived} audit logs older than 2 years`);
      }
    } catch (error) {
      this.logger.error(
        `Audit archival failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
