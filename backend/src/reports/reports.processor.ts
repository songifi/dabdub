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
import {
  ReportsService,
  REPORT_QUEUE,
  GENERATE_REPORT_JOB,
  CLEANUP_REPORT_JOB,
} from './reports.service';
import { ReportParams, ReportStatus, ReportType } from './entities/report-job.entity';
import { EmailService } from '../email/email.service';
import { generateCsv } from './report-generator';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Transfer } from '../transfers/entities/transfer.entity';
import { Withdrawal } from '../withdrawals/entities/withdrawal.entity';
import { Deposit } from '../deposits/entities/deposit.entity';
import { PayLink } from '../paylink/entities/pay-link.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { SupportTicket } from '../feedback/entities/support-ticket.entity';
import { LoginHistory } from '../security/entities/login-history.entity';
import { DeviceToken } from '../push/entities/device-token.entity';
import { KycSubmission } from '../kyc/entities/kyc-submission.entity';
import { Referral } from '../referrals/entities/referral.entity';
import { Feedback } from '../feedback/entities/feedback.entity';
import {
  buildGdprExportPayload,
  GDPR_EXPORT_README,
} from './gdpr-export.util';
import { createZip } from './zip.util';
import { generateAccountStatementPdf } from './statement-pdf.util';

const DEFAULT_PRESIGN_EXPIRY_SECONDS = 24 * 60 * 60;
const GDPR_PRESIGN_EXPIRY_SECONDS = 48 * 60 * 60;

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

    await this.reportsService.update(jobId, { status: ReportStatus.PROCESSING });

    const generated = await this.generateByType(reportJob.requestedBy, reportJob.type, reportJob.params);

    const fileKey = `reports/${reportJob.requestedBy}/${jobId}.${generated.extension}`;
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      Body: generated.buffer,
      ContentType: generated.contentType,
    }));

    const fileUrl = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: fileKey }),
      { expiresIn: generated.expiresInSeconds },
    );

    const expiresAt = new Date(Date.now() + generated.expiresInSeconds * 1000);

    await this.reportsService.update(jobId, {
      status: ReportStatus.READY,
      fileKey,
      fileUrl,
      expiresAt,
    });

    this.logger.log(`Report ${jobId} ready — key=${fileKey}`);

    const userEmail = await this.lookupUserEmail(reportJob.requestedBy);
    if (!userEmail) {
      this.logger.warn(`Unable to resolve user email for report ${jobId}`);
      return;
    }

    this.emailService
      .queue(
        userEmail,
        'report-ready',
        {
          reportType: reportJob.type,
          downloadUrl: fileUrl,
          expiresAt: expiresAt.toISOString(),
        },
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

  private async generateByType(
    userId: string,
    type: ReportType,
    params: ReportParams,
  ): Promise<{ buffer: Buffer; contentType: string; extension: string; expiresInSeconds: number }> {
    if (type === ReportType.GDPR_EXPORT) {
      const buffer = await this.generateGdprZip(userId);
      return {
        buffer,
        contentType: 'application/zip',
        extension: 'zip',
        expiresInSeconds: GDPR_PRESIGN_EXPIRY_SECONDS,
      };
    }

    if (type === ReportType.ACCOUNT_STATEMENT) {
      const buffer = await this.generateStatementPdf(userId, params);
      return {
        buffer,
        contentType: 'application/pdf',
        extension: 'pdf',
        expiresInSeconds: DEFAULT_PRESIGN_EXPIRY_SECONDS,
      };
    }

    const csvBuffer = await generateCsv(this.dataSource, type, params as any);
    return {
      buffer: csvBuffer,
      contentType: 'text/csv',
      extension: 'csv',
      expiresInSeconds: DEFAULT_PRESIGN_EXPIRY_SECONDS,
    };
  }

  private async generateGdprZip(userId: string): Promise<Buffer> {
    const userRepo = this.dataSource.getRepository(User);
    const walletRepo = this.dataSource.getRepository(Wallet);
    const txRepo = this.dataSource.getRepository(Transaction);
    const transferRepo = this.dataSource.getRepository(Transfer);
    const withdrawalRepo = this.dataSource.getRepository(Withdrawal);
    const depositRepo = this.dataSource.getRepository(Deposit);
    const payLinkRepo = this.dataSource.getRepository(PayLink);
    const notificationRepo = this.dataSource.getRepository(Notification);
    const supportTicketRepo = this.dataSource.getRepository(SupportTicket);
    const loginRepo = this.dataSource.getRepository(LoginHistory);
    const deviceTokenRepo = this.dataSource.getRepository(DeviceToken);
    const kycRepo = this.dataSource.getRepository(KycSubmission);
    const referralRepo = this.dataSource.getRepository(Referral);
    const feedbackRepo = this.dataSource.getRepository(Feedback);

    const [
      userProfile,
      wallet,
      transactions,
      transfersFrom,
      transfersTo,
      withdrawals,
      deposits,
      payLinks,
      notifications,
      supportTickets,
      loginHistory,
      deviceTokens,
      kycSubmissions,
      referralsFrom,
      referralsTo,
      feedback,
    ] = await Promise.all([
      userRepo.findOne({ where: { id: userId } }),
      walletRepo.findOne({ where: { userId } }),
      txRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
      transferRepo.find({ where: { fromUserId: userId }, order: { createdAt: 'DESC' } }),
      transferRepo.find({ where: { toUserId: userId }, order: { createdAt: 'DESC' } }),
      withdrawalRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
      depositRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
      payLinkRepo.find({ where: [{ creatorUserId: userId }, { paidByUserId: userId }], order: { createdAt: 'DESC' } }),
      notificationRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
      supportTicketRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
      loginRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
      deviceTokenRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
      kycRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
      referralRepo.find({ where: { referrerId: userId }, order: { createdAt: 'DESC' } }),
      referralRepo.find({ where: { referredUserId: userId }, order: { createdAt: 'DESC' } }),
      feedbackRepo.find({ where: { userId }, order: { createdAt: 'DESC' } }),
    ]);

    const contactsSet = new Set<string>();
    for (const transfer of [...transfersFrom, ...transfersTo]) {
      if (transfer.fromUserId === userId && transfer.toUsername) {
        contactsSet.add(transfer.toUsername);
      }
      if (transfer.toUserId === userId && transfer.fromUsername) {
        contactsSet.add(transfer.fromUsername);
      }
    }
    for (const tx of transactions) {
      if (tx.counterpartyUsername) {
        contactsSet.add(tx.counterpartyUsername);
      }
    }

    const payload = buildGdprExportPayload({
      userProfile,
      wallet,
      transactions,
      transfers: [...transfersFrom, ...transfersTo],
      withdrawals,
      deposits,
      payLinks,
      contacts: Array.from(contactsSet).map((username) => ({ username })),
      notifications,
      supportTickets,
      loginHistory,
      deviceTokens,
      kycSubmissions,
      referrals: [...referralsFrom, ...referralsTo],
      feedback,
    });

    return createZip([
      {
        name: 'README.txt',
        content: Buffer.from(GDPR_EXPORT_README, 'utf8'),
      },
      {
        name: 'personal-data.json',
        content: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
      },
    ]);
  }

  private async generateStatementPdf(
    userId: string,
    params: ReportParams,
  ): Promise<Buffer> {
    const dateFrom = String(params.dateFrom ?? '');
    const dateTo = String(params.dateTo ?? '');

    const userRepo = this.dataSource.getRepository(User);
    const txRepo = this.dataSource.getRepository(Transaction);

    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found for statement export');
    }

    const transactions = await txRepo
      .createQueryBuilder('tx')
      .where('tx.userId = :userId', { userId })
      .andWhere('tx.createdAt >= :from', { from: new Date(dateFrom) })
      .andWhere('tx.createdAt <= :to', { to: new Date(dateTo) })
      .orderBy('tx.createdAt', 'ASC')
      .getMany();

    return generateAccountStatementPdf({
      user: {
        displayName: user.displayName,
        username: user.username,
        tier: user.tier,
      },
      dateFrom,
      dateTo,
      transactions,
    });
  }

  private async lookupUserEmail(userId: string): Promise<string | null> {
    const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
    return user?.email ?? null;
  }
}
