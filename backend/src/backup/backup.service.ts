import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createReadStream, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AdminAlertService } from '../alerts/admin-alert.service';
import { AdminAlertType } from '../alerts/admin-alert.entity';
import { CronJobService } from '../cron/cron-job.service';

const execAsync = promisify(exec);

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly retentionDays: number;

  constructor(
    private readonly config: ConfigService,
    private readonly alertService: AdminAlertService,
    private readonly cronJobService: CronJobService,
  ) {
    this.bucket = this.config.getOrThrow<string>('BACKUP_S3_BUCKET');
    this.retentionDays = this.config.get<number>('BACKUP_RETENTION_DAYS', 30);

    this.s3 = new S3Client({
      region: this.config.get<string>('BACKUP_S3_REGION', 'us-east-1'),
      endpoint: this.config.get<string>('BACKUP_S3_ENDPOINT'), // Cloudflare R2 or AWS
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('BACKUP_S3_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('BACKUP_S3_SECRET_ACCESS_KEY'),
      },
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runDailyBackup(): Promise<void> {
    try {
      await this.cronJobService.run('db-backup', async () => {
        await this.dumpAndUpload();
        await this.pruneOldBackups();
      });
    } catch (error) {
      await this.onBackupFailed(error instanceof Error ? error : new Error(String(error)));
      // Do not re-throw — alert has been raised, cron log already records failure
    }
  }

  private async dumpAndUpload(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.dump`;
    const localPath = join(tmpdir(), filename);

    const host = this.config.getOrThrow<string>('DB_HOST');
    const port = this.config.get<number>('DB_PORT', 5432);
    const user = this.config.getOrThrow<string>('DB_USER');
    const dbName = this.config.getOrThrow<string>('DB_NAME');
    const password = this.config.getOrThrow<string>('DB_PASSWORD');

    try {
      await execAsync(
        `pg_dump -Fc -h ${host} -p ${port} -U ${user} -d ${dbName} -f ${localPath}`,
        { env: { ...process.env, PGPASSWORD: password } },
      );

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: `backups/${filename}`,
          Body: createReadStream(localPath),
          StorageClass: 'STANDARD_IA',
        }),
      );

      this.logger.log(`Backup uploaded: backups/${filename}`);
    } finally {
      try { unlinkSync(localPath); } catch { /* already gone */ }
    }
  }

  private async pruneOldBackups(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);

    const list = await this.s3.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: 'backups/' }),
    );

    const toDelete = (list.Contents ?? []).filter(
      (obj) => obj.LastModified && obj.LastModified < cutoff,
    );

    await Promise.all(
      toDelete.map((obj) =>
        this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: obj.Key! })),
      ),
    );

    if (toDelete.length > 0) {
      this.logger.log(`Pruned ${toDelete.length} backup(s) older than ${this.retentionDays} days`);
    }
  }

  /** Called by CronJobService on failure — raises an admin alert. */
  async onBackupFailed(error: Error): Promise<void> {
    await this.alertService.raise({
      type: AdminAlertType.BACKUP_FAILURE,
      dedupeKey: 'db-backup-daily',
      message: `Daily database backup failed: ${error.message}`,
      metadata: { stack: error.stack },
      thresholdValue: 1,
    });
  }
}
