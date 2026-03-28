import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Job } from 'bull';
import type { ConfigType } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Config } from '../config/r2.config';
import { ReportsService, REPORT_QUEUE, GENERATE_REPORT_JOB, CLEANUP_REPORT_JOB } from './reports.service';
import { ReportStatus } from './entities/report-job.entity';
import { EmailService } from '../email/email.service';
import { generateCsv } from './report-generator';

const PRESIGN_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

export interface GenerateReportPayload {
  jobId: string;
}

@Processor(REPORT_QUEUE)
export class ReportsProcessor {
  private readonly logger = new Logger(ReportsProcessor.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly reportsService: ReportsService,
    private readonly emailService: EmailService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(r2Config.KEY)
    private readonly cfg: ConfigType<typeof r2Config>,
  ) {
    this.bucket = cfg.bucketName;
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }

  @Process(GENERATE_REPORT_JOB)
  async handleGenerate(job: Job<GenerateReportPayload>): Promise<void> {
    const { jobId } = job.data;
    const reportJob = await this.reportsService.findById(jobId);
    if (!reportJob) {
      this.logger.warn(`ReportJob ${jobId} not found — skipping`);
      return;
    }

    // Mark processing
    await this.reportsService.update(jobId, { status: ReportStatus.PROCESSING });

    // Generate CSV via cursor-based streaming
    const csvBuffer = await generateCsv(this.dataSource, reportJob.type, reportJob.params);

    // Upload to R2
    const fileKey = `reports/${reportJob.requestedBy}/${jobId}.csv`;
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      Body: csvBuffer,
      ContentType: 'text/csv',
    }));

    // Presigned GET URL — 24h expiry
    const fileUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: fileKey }),
      { expiresIn: PRESIGN_EXPIRY_SECONDS },
    );

    const expiresAt = new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000);

    await this.reportsService.update(jobId, {
      status: ReportStatus.READY,
      fileKey,
      fileUrl,
      expiresAt,
    });

    this.logger.log(`Report ${jobId} ready — key=${fileKey}`);

    // Send download email (fire-and-forget)
    this.emailService
      .queue(
        reportJob.requestedBy, // processor uses userId; controller layer resolves email
        'report-ready',
        { reportType: reportJob.type, downloadUrl: fileUrl, expiresAt: expiresAt.toISOString() },
        reportJob.requestedBy,
      )
      .catch((err: Error) => this.logger.warn(`Report email failed: ${err.message}`));
  }

  @Process(CLEANUP_REPORT_JOB)
  async handleCleanup(_job: Job): Promise<void> {
    const expired = await this.reportsService.deleteExpired();

    for (const report of expired) {
      if (report.fileKey) {
        try {
          await this.s3.send(new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: report.fileKey,
          }));
          this.logger.log(`Deleted R2 object: ${report.fileKey}`);
        } catch (err) {
          this.logger.warn(`Failed to delete R2 object ${report.fileKey}: ${(err as Error).message}`);
        }
      }
    }

    this.logger.log(`Cleaned up ${expired.length} expired report jobs`);
  }

  @OnQueueFailed()
  async handleFailed(job: Job<GenerateReportPayload>, err: Error): Promise<void> {
    const { jobId } = job.data;
    const isExhausted = job.attemptsMade >= (job.opts.attempts ?? 3);
    this.logger.warn(`Report job ${jobId} failed attempt=${job.attemptsMade}: ${err.message}`);

    if (isExhausted) {
      await this.reportsService.update(jobId, {
        status: ReportStatus.FAILED,
        errorMessage: err.message,
      });
    }
  }
}
