import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ConfigType } from '@nestjs/config';
import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Config } from '../config/r2.config';
import { KycSubmission, KycSubmissionStatus } from './entities/kyc-submission.entity';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { RejectKycDto } from './dto/reject-kyc.dto';
import { AdminKycQueryDto } from './dto/admin-kyc-query.dto';
import { User, KycStatus } from '../users/entities/user.entity';
import { TierName } from '../tier-config/entities/tier-config.entity';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notifications.types';

const PRESIGN_EXPIRY = 15 * 60; // 15 minutes

@Injectable()
export class KycService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    @InjectRepository(KycSubmission)
    private readonly repo: Repository<KycSubmission>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(r2Config.KEY)
    private readonly cfg: ConfigType<typeof r2Config>,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
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

  // ── User endpoints ──────────────────────────────────────────────────────────

  async submit(userId: string, dto: SubmitKycDto): Promise<KycSubmission> {
    // Max 1 active submission per user
    const active = await this.repo.findOne({
      where: [
        { userId, status: KycSubmissionStatus.PENDING },
        { userId, status: KycSubmissionStatus.UNDER_REVIEW },
      ],
    });
    if (active) {
      throw new ConflictException('You already have an active KYC submission');
    }

    const submission = this.repo.create({
      userId,
      targetTier: dto.targetTier,
      status: KycSubmissionStatus.PENDING,
      bvnLast4: dto.bvnLast4,
      ninLast4: dto.ninLast4,
      documentType: dto.documentType,
      documentFrontKey: dto.documentFrontKey,
      documentBackKey: dto.documentBackKey ?? null,
      selfieKey: dto.selfieKey,
    });

    const saved = await this.repo.save(submission);

    // Update user kyc_status
    await this.userRepo.update(userId, { kycStatus: KycStatus.PENDING });

    // Notify admin via email (fire-and-forget)
    this.emailService
      .queue('admin@system.local', 'kyc-new-submission', {
        submissionId: saved.id,
        userId,
        targetTier: dto.targetTier,
      })
      .catch(() => undefined);

    return saved;
  }

  async getMySubmission(userId: string): Promise<KycSubmission | null> {
    return this.repo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Admin endpoints ─────────────────────────────────────────────────────────

  async adminList(
    query: AdminKycQueryDto,
  ): Promise<{ data: KycSubmission[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('k')
      .orderBy('k.created_at', 'ASC'); // FIFO

    if (query.status) qb.andWhere('k.status = :status', { status: query.status });
    if (query.targetTier) qb.andWhere('k.target_tier = :targetTier', { targetTier: query.targetTier });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async adminGetDetail(id: string): Promise<KycSubmission & {
    documentFrontUrl: string;
    documentBackUrl: string | null;
    selfieUrl: string;
  }> {
    const submission = await this.repo.findOne({ where: { id } });
    if (!submission) throw new NotFoundException('KYC submission not found');

    const [documentFrontUrl, selfieUrl, documentBackUrl] = await Promise.all([
      this.presign(submission.documentFrontKey),
      this.presign(submission.selfieKey),
      submission.documentBackKey ? this.presign(submission.documentBackKey) : Promise.resolve(null),
    ]);

    return Object.assign(submission, { documentFrontUrl, documentBackUrl, selfieUrl });
  }

  async approve(id: string, adminId: string): Promise<KycSubmission> {
    const submission = await this.findActiveOrFail(id);

    submission.status = KycSubmissionStatus.APPROVED;
    submission.reviewedBy = adminId;
    submission.reviewedAt = new Date();
    await this.repo.save(submission);

    // Upgrade user tier
    const newTier = submission.targetTier as TierName;
    await this.userRepo.update(submission.userId, {
      tier: newTier,
      kycStatus: KycStatus.APPROVED,
    });

    const user = await this.userRepo.findOne({ where: { id: submission.userId } });

    // WebSocket + in-app notification
    await this.notificationService.create(
      submission.userId,
      NotificationType.TIER_UPGRADED,
      'KYC Approved',
      `Your KYC has been approved. You are now on the ${newTier} tier.`,
      { submissionId: id, tier: newTier },
    );

    // Email notification
    if (user) {
      this.emailService
        .queue(user.email, 'kyc-approved', { tier: newTier })
        .catch(() => undefined);
    }

    return submission;
  }

  async reject(id: string, adminId: string, dto: RejectKycDto): Promise<KycSubmission> {
    const submission = await this.findActiveOrFail(id);

    submission.status = KycSubmissionStatus.REJECTED;
    submission.reviewedBy = adminId;
    submission.reviewedAt = new Date();
    submission.reviewNote = dto.reviewNote;
    await this.repo.save(submission);

    await this.userRepo.update(submission.userId, { kycStatus: KycStatus.REJECTED });

    const user = await this.userRepo.findOne({ where: { id: submission.userId } });

    // WebSocket + in-app notification
    await this.notificationService.create(
      submission.userId,
      NotificationType.KYC_UPDATE,
      'KYC Rejected',
      `Your KYC submission was rejected. Reason: ${dto.reviewNote}`,
      { submissionId: id, reviewNote: dto.reviewNote },
    );

    // Email with reason
    if (user) {
      this.emailService
        .queue(user.email, 'kyc-rejected', { reviewNote: dto.reviewNote })
        .catch(() => undefined);
    }

    return submission;
  }

  async requestInfo(id: string, adminId: string): Promise<KycSubmission> {
    const submission = await this.findActiveOrFail(id);

    submission.status = KycSubmissionStatus.UNDER_REVIEW;
    submission.reviewedBy = adminId;
    submission.reviewedAt = new Date();
    await this.repo.save(submission);

    await this.userRepo.update(submission.userId, { kycStatus: KycStatus.PENDING });

    // Notify user
    await this.notificationService.create(
      submission.userId,
      NotificationType.KYC_UPDATE,
      'Additional Info Required',
      'Your KYC submission is under review. Additional information may be requested.',
      { submissionId: id },
    );

    return submission;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findActiveOrFail(id: string): Promise<KycSubmission> {
    const submission = await this.repo.findOne({ where: { id } });
    if (!submission) throw new NotFoundException('KYC submission not found');
    return submission;
  }

  private async presign(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: PRESIGN_EXPIRY });
  }
}
