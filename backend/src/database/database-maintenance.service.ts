import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

/**
 * DatabaseMaintenanceService
 *
 * Runs periodic cleanup jobs to maintain database health.
 * Scheduled via @nestjs/schedule decorators.
 *
 * Cleanup operations:
 *   - OTPs: Delete expired entries older than 7 days
 *   - Refresh Tokens: Delete revoked entries older than 30 days
 *   - Webhook Logs: Delete entries older than 90 days
 *
 * These operations run once per week to balance performance with cleanup frequency.
 */
@Injectable()
export class DatabaseMaintenanceService {
  private readonly logger = new Logger(DatabaseMaintenanceService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Weekly cleanup: remove expired OTPs
   * Runs every Sunday at 2:00 AM UTC
   */
  @Cron(CronExpression.EVERY_WEEK, { timeZone: 'UTC' })
  async cleanupExpiredOtps(): Promise<void> {
    try {
      const result = await this.dataSource.query(
        `DELETE FROM "otps" WHERE "expires_at" < NOW() - INTERVAL '7 days'`,
      );

      const rowsDeleted = result?.length || 0;
      this.logger.log(`[DB Cleanup] Deleted ${rowsDeleted} expired OTP records`);
    } catch (error) {
      this.logger.error(
        `[DB Cleanup] Failed to cleanup expired OTPs: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Do not throw — allow cron to continue even if one task fails
    }
  }

  /**
   * Weekly cleanup: remove revoked refresh tokens older than 30 days
   * Runs every Sunday at 2:15 AM UTC
   */
  @Cron('15 2 * * 0', { timeZone: 'UTC' })
  async cleanupRevokedRefreshTokens(): Promise<void> {
    try {
      const result = await this.dataSource.query(
        `DELETE FROM "refresh_tokens" WHERE "revoked_at" IS NOT NULL AND "revoked_at" < NOW() - INTERVAL '30 days'`,
      );

      const rowsDeleted = result?.length || 0;
      this.logger.log(`[DB Cleanup] Deleted ${rowsDeleted} revoked refresh tokens`);
    } catch (error) {
      this.logger.error(
        `[DB Cleanup] Failed to cleanup revoked refresh tokens: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Weekly cleanup: remove old webhook delivery logs
   * Runs every Sunday at 2:30 AM UTC
   */
  @Cron('30 2 * * 0', { timeZone: 'UTC' })
  async cleanupOldWebhookLogs(): Promise<void> {
    try {
      const result = await this.dataSource.query(
        `DELETE FROM "webhook_deliveries" WHERE "created_at" < NOW() - INTERVAL '90 days'`,
      );

      const rowsDeleted = result?.length || 0;
      this.logger.log(`[DB Cleanup] Deleted ${rowsDeleted} old webhook delivery logs`);
    } catch (error) {
      this.logger.error(
        `[DB Cleanup] Failed to cleanup old webhook logs: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Manual trigger for cleanup (useful for testing or admin operations)
   */
  async runAllCleanupJobs(): Promise<void> {
    this.logger.log('[DB Cleanup] Starting manual cleanup run...');
    await this.cleanupExpiredOtps();
    await this.cleanupRevokedRefreshTokens();
    await this.cleanupOldWebhookLogs();
    this.logger.log('[DB Cleanup] Manual cleanup run completed');
  }
}
