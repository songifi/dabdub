import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycSubmission, KycSubmissionStatus } from './entities/kyc-submission.entity';
import { VerificationResult, VerificationType, VerificationStatus } from './entities/verification-result.entity';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { RejectKycDto } from './dto/reject-kyc.dto';
import { AdminKycQueryDto } from './dto/admin-kyc-query.dto';
import { User, KycStatus } from '../users/entities/user.entity';
import { TierName } from '../tier-config/entities/tier-config.entity';
import { EmailService } from '../email/email.service';
import { NotificationService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notifications.types';
import { R2Service } from '../r2/r2.service';
import { PremblyService, VerifyResult } from '../prembly/prembly.service';
import { TierUpgradeService } from '../tier-config/tier-upgrade.service';

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycSubmission)
    private readonly repo: Repository<KycSubmission>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(VerificationResult)
    private readonly verificationRepo: Repository<VerificationResult>,
    private readonly r2: R2Service,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
    private readonly premblyService: PremblyService,
    private readonly tierUpgradeService: TierUpgradeService,
  ) {}

  // ── User endpoints ──────────────────────────────────────────────────────────

  async submit(userId: string, dto: SubmitKycDto): Promise<KycSubmission> {
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

    await this.userRepo.update(userId, { kycStatus: KycStatus.PENDING });

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
      .orderBy('k.created_at', 'ASC');

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
      this.r2.getPresignedDownloadUrl(submission.documentFrontKey),
      this.r2.getPresignedDownloadUrl(submission.selfieKey),
      submission.documentBackKey
        ? this.r2.getPresignedDownloadUrl(submission.documentBackKey)
        : Promise.resolve(null),
    ]);

    return Object.assign(submission, { documentFrontUrl, documentBackUrl, selfieUrl });
  }

  async approve(id: string, adminId: string): Promise<KycSubmission> {
    const submission = await this.findActiveOrFail(id);

    submission.status = KycSubmissionStatus.APPROVED;
    submission.reviewedBy = adminId;
    submission.reviewedAt = new Date();
    await this.repo.save(submission);

    await this.userRepo.update(submission.userId, {
      kycStatus: KycStatus.APPROVED,
    });

    const upgradedViaPending = await this.tierUpgradeService.checkAutoUpgrade(
      submission.userId,
    );

    if (!upgradedViaPending) {
      await this.tierUpgradeService.applySubmissionTierAfterKyc(
        submission.userId,
        submission.targetTier as TierName,
      );
    }

    const user = await this.userRepo.findOne({ where: { id: submission.userId } });
    const effectiveTier = user?.tier ?? (submission.targetTier as TierName);

    await this.notificationService.create(
      submission.userId,
      NotificationType.TIER_UPGRADED,
      'KYC Approved',
      `Your KYC has been approved. You are now on the ${effectiveTier} tier.`,
      { submissionId: id, tier: effectiveTier },
    );

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

    await this.notificationService.create(
      submission.userId,
      NotificationType.KYC_UPDATE,
      'KYC Rejected',
      `Your KYC submission was rejected. Reason: ${dto.reviewNote}`,
      { submissionId: id, reviewNote: dto.reviewNote },
    );

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

    await this.notificationService.create(
      submission.userId,
      NotificationType.KYC_UPDATE,
      'Additional Info Required',
      'Your KYC submission is under review. Additional information may be requested.',
      { submissionId: id },
    );

    return submission;
  }

  // ── Prembly auto-verification ───────────────────────────────────────────────

  async runVerification(submissionId: string): Promise<VerificationResult[]> {
    const submission = await this.repo.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('KYC submission not found');

    const user = await this.userRepo.findOneOrFail({ where: { id: submission.userId } });

    const [bvnSettled, ninSettled] = await Promise.allSettled([
      this.premblyService.verifyBvn(submission.bvnLast4, submission.userId),
      this.premblyService.verifyNin(submission.ninLast4, submission.userId),
    ]);

    const entries: [VerificationType, PromiseSettledResult<VerifyResult>, string][] = [
      [VerificationType.BVN, bvnSettled, submission.bvnLast4],
      [VerificationType.NIN, ninSettled, submission.ninLast4],
    ];

    const results: VerificationResult[] = [];

    for (const [type, settled, maskedInput] of entries) {
      const passed = settled.status === 'fulfilled' && settled.value.verified;
      const status = passed ? VerificationStatus.PASSED : VerificationStatus.FAILED;

      const verifiedName = passed
        ? `${(settled as PromiseFulfilledResult<VerifyResult>).value.firstName} ${(settled as PromiseFulfilledResult<VerifyResult>).value.lastName}`
        : null;

      const rawResponse =
        settled.status === 'fulfilled'
          ? settled.value
          : { error: String((settled as PromiseRejectedResult).reason) };

      const record = this.verificationRepo.create({
        userId: submission.userId,
        submissionId,
        verificationType: type,
        status,
        maskedInput,
        verifiedName,
        rawResponse: rawResponse as Record<string, unknown>,
      });

      results.push(await this.verificationRepo.save(record));
    }

    const allPassed = results.every((r) => r.status === VerificationStatus.PASSED);

    if (allPassed) {
      await this.approve(submissionId, 'system');
    } else {
      submission.status = KycSubmissionStatus.UNDER_REVIEW;
      submission.reviewNote = results
        .filter((r) => r.status === VerificationStatus.FAILED)
        .map((r) => `${r.verificationType} verification failed`)
        .join('; ');
      await this.repo.save(submission);

      await this.notificationService.create(
        submission.userId,
        NotificationType.KYC_UPDATE,
        'KYC Under Manual Review',
        'Your identity verification requires manual review.',
        { submissionId },
      );

      this.emailService
        .queue(user.email, 'kyc-manual-review', { submissionId })
        .catch(() => undefined);
    }

    return results;
  }

  async getVerificationResults(submissionId: string): Promise<VerificationResult[]> {
    const submission = await this.repo.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('KYC submission not found');
    return this.verificationRepo.find({
      where: { submissionId },
      order: { createdAt: 'ASC' },
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async findActiveOrFail(id: string): Promise<KycSubmission> {
    const submission = await this.repo.findOne({ where: { id } });
    if (!submission) throw new NotFoundException('KYC submission not found');
    return submission;
  }
}
