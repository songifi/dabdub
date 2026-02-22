import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, IsNull, Not } from 'typeorm';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

import { MerchantOnboardingProgress, OnboardingStepKey } from '../entities/merchant-onboarding-progress.entity';
import { Merchant } from '../../database/entities/merchant.entity';
import {
  OnboardingFunnelResponseDto,
  OnboardingMerchantListDto,
  OnboardingMerchantDetailDto,
  OnboardingMetricsDto,
  OnboardingListQueryDto,
} from '../dto/merchant-onboarding.dto';

const ONBOARDING_STEPS: OnboardingStepKey[] = [
  'ACCOUNT_CREATED',
  'EMAIL_VERIFIED',
  'BUSINESS_PROFILE_COMPLETE',
  'KYC_SUBMITTED',
  'KYC_APPROVED',
  'BANK_ACCOUNT_LINKED',
  'API_KEY_GENERATED',
  'FIRST_TRANSACTION',
  'FIRST_SETTLEMENT',
];

@Injectable()
export class MerchantOnboardingService {
  constructor(
    @InjectRepository(MerchantOnboardingProgress)
    private progressRepository: Repository<MerchantOnboardingProgress>,
    @InjectRepository(Merchant)
    private merchantRepository: Repository<Merchant>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    @InjectQueue('notifications')
    private notificationQueue: Queue,
  ) {}

  async getFunnelStats(): Promise<OnboardingFunnelResponseDto> {
    // Try to get from cache
    const cached = await this.cacheManager.get<OnboardingFunnelResponseDto>(
      'onboarding:funnel:stats',
    );
    if (cached) return cached;

    const funnel: Partial<{ [key in OnboardingStepKey]: { count: number; dropoffCount: number; dropoffRate: string } }> = {};
    let previousCount = 0;

    for (const step of ONBOARDING_STEPS) {
      const count = await this.progressRepository.count({
        where: {
          steps: {
            status: Not('NOT_STARTED'),
          },
        },
      });

      const dropoffCount = previousCount > 0 ? previousCount - count : 0;
      const dropoffRate = previousCount > 0 ? ((dropoffCount / previousCount) * 100).toFixed(1) : '0.0';

      funnel[step] = {
        count,
        dropoffCount,
        dropoffRate,
      };

      previousCount = count;
    }

    const stuckMerchants = await this.progressRepository.count({
      where: { isStuck: true },
    });

    const totalProgress = await this.progressRepository.find();
    const activatedCount = totalProgress.filter(
      (p) => p.completedStepCount === p.totalStepCount,
    ).length;

    const averageDaysToActivation =
      activatedCount > 0
        ? totalProgress
            .filter((p) => p.completedStepCount === p.totalStepCount && p.lastProgressAt)
            .reduce((sum, p) => {
              const diffMs = (p.lastProgressAt!.getTime() - p.createdAt.getTime());
              return sum + (diffMs / (1000 * 60 * 60 * 24));
            }, 0) / activatedCount
        : 0;

    const totalStarted = totalProgress.length;
    const conversionRate =
      totalStarted > 0 ? ((activatedCount / totalStarted) * 100).toFixed(1) : '0.0';

    const result: OnboardingFunnelResponseDto = {
      funnel: funnel as { [key in OnboardingStepKey]: { count: number; dropoffCount: number; dropoffRate: string } },
      stuckMerchants,
      averageDaysToActivation: parseFloat(averageDaysToActivation.toFixed(1)),
      conversionRate,
    };

    // Cache for 10 minutes
    await this.cacheManager.set('onboarding:funnel:stats', result, 600000);

    return result;
  }

  async listMerchants(query: OnboardingListQueryDto): Promise<{ data: OnboardingMerchantListDto[]; total: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.currentStep) {
      where.steps = {
        status: 'IN_PROGRESS',
      };
    }

    if (query.isStuck !== undefined) {
      where.isStuck = query.isStuck;
    }

    if (query.minDaysInCurrentStep !== undefined) {
      where.daysInCurrentStep = MoreThan(query.minDaysInCurrentStep);
    }

    if (query.createdAfter) {
      where.createdAt = MoreThan(new Date(query.createdAfter));
    }

    const [data, total] = await this.progressRepository.findAndCount({
      where,
      relations: ['merchant'],
      order: { daysInCurrentStep: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: data.map((p) => ({
        merchantId: p.merchantId,
        merchantName: p.merchant.name,
        completionPercentage: p.completionPercentage,
        completedStepCount: p.completedStepCount,
        totalStepCount: p.totalStepCount,
        currentStep: this.getCurrentStep(p.steps),
        daysInCurrentStep: p.daysInCurrentStep,
        isStuck: p.isStuck,
        lastProgressAt: p.lastProgressAt,
        createdAt: p.createdAt,
      })),
      total,
    };
  }

  async getMerchantDetail(merchantId: string): Promise<OnboardingMerchantDetailDto> {
    const progress = await this.progressRepository.findOne({
      where: { merchantId },
      relations: ['merchant'],
    });

    if (!progress) {
      throw new NotFoundException('Onboarding progress not found for this merchant');
    }

    return {
      merchantId: progress.merchantId,
      merchantName: progress.merchant.name,
      merchantEmail: progress.merchant.email,
      completionPercentage: progress.completionPercentage,
      completedStepCount: progress.completedStepCount,
      totalStepCount: progress.totalStepCount,
      isStuck: progress.isStuck,
      steps: progress.steps.map((s) => ({
        key: s.key,
        status: s.status,
        completedAt: s.completedAt,
        blockedReason: s.blockedReason,
      })),
      lastProgressAt: progress.lastProgressAt,
      daysInCurrentStep: progress.daysInCurrentStep,
    };
  }

  async sendNudgeEmail(merchantId: string, customMessage?: string): Promise<void> {
    const progress = await this.progressRepository.findOne({
      where: { merchantId },
      relations: ['merchant'],
    });

    if (!progress) {
      throw new NotFoundException('Onboarding progress not found');
    }

    // Check rate limiting (once per 48 hours)
    const lastNudgeKey = `onboarding:nudge:${merchantId}`;
    const lastNudge = await this.cacheManager.get<number>(lastNudgeKey);

    if (lastNudge) {
      throw new BadRequestException('Nudge email already sent within the last 48 hours');
    }

    const currentStep = this.getCurrentStep(progress.steps);
    if (!currentStep) {
      throw new BadRequestException('Merchant has no current step');
    }

    // Queue the email
    await this.notificationQueue.add('nudge-email', {
      merchantId,
      merchantEmail: progress.merchant.email,
      merchantName: progress.merchant.name,
      currentStep,
      customMessage,
    });

    // Set rate limit (48 hours)
    await this.cacheManager.set(lastNudgeKey, Date.now(), 172800000);

    // Audit log (would be done via another service)
  }

  async skipStep(merchantId: string, step: OnboardingStepKey, reason: string): Promise<void> {
    const progress = await this.progressRepository.findOne({
      where: { merchantId },
    });

    if (!progress) {
      throw new NotFoundException('Onboarding progress not found');
    }

    const stepIndex = progress.steps.findIndex((s) => s.key === step);
    if (stepIndex === -1) {
      throw new BadRequestException('Step not found in onboarding process');
    }

    // Mark as completed
    progress.steps[stepIndex].status = 'COMPLETED';
    progress.steps[stepIndex].completedAt = new Date();

    // Update counts
    const completedCount = progress.steps.filter((s) => s.status === 'COMPLETED').length;
    progress.completedStepCount = completedCount;
    progress.completionPercentage = (
      (completedCount / progress.totalStepCount) *
      100
    ).toFixed(2);

    progress.lastProgressAt = new Date();

    await this.progressRepository.save(progress);

    // Invalidate cache
    await this.cacheManager.del('onboarding:funnel:stats');

    // Audit log (would be done via another service)
  }

  async getMetrics(): Promise<OnboardingMetricsDto> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const newSignups = await this.progressRepository.count({
      where: { createdAt: MoreThan(thirtyDaysAgo) },
    });

    const progressData = await this.progressRepository.find({
      where: { createdAt: MoreThan(thirtyDaysAgo) },
    });

    const activatedCount = progressData.filter(
      (p) => p.completedStepCount === p.totalStepCount,
    ).length;

    const stuckCount = progressData.filter((p) => p.isStuck).length;

    const activationRate =
      newSignups > 0 ? ((activatedCount / newSignups) * 100).toFixed(1) : '0.0';

    const averageDaysToActivation =
      activatedCount > 0
        ? progressData
            .filter(
              (p) => p.completedStepCount === p.totalStepCount && p.lastProgressAt,
            )
            .reduce((sum, p) => {
              const diffMs = p.lastProgressAt!.getTime() - p.createdAt.getTime();
              return sum + diffMs / (1000 * 60 * 60 * 24);
            }, 0) / activatedCount
        : 0;

    // For nudge metrics, would need to track separately
    // Using placeholder values
    const nudgesSent = 0;
    const nudgeConversionRate = '0.0';

    return {
      last30d: {
        newSignups,
        activatedCount,
        activationRate,
        averageDaysToActivation: parseFloat(averageDaysToActivation.toFixed(1)),
        stuckCount,
        nudgesSent,
        nudgeConversionRate,
      },
    };
  }

  async updateStuckStatus(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Find merchants with no progress in 7 days and not fully completed
    const stuck = await this.progressRepository.find({
      where: {
        lastProgressAt: LessThan(sevenDaysAgo),
        completionPercentage: Not('100.00'),
      },
    });

    for (const progress of stuck) {
      progress.isStuck = true;
      await this.progressRepository.save(progress);
    }

    // Find merchants with progress and mark them as not stuck
    const notStuck = await this.progressRepository.find({
      where: {
        lastProgressAt: MoreThan(sevenDaysAgo),
        isStuck: true,
      },
    });

    for (const progress of notStuck) {
      progress.isStuck = false;
      await this.progressRepository.save(progress);
    }
  }

  private getCurrentStep(steps: any[]): OnboardingStepKey | null {
    const inProgress = steps.find((s) => s.status === 'IN_PROGRESS');
    if (inProgress) return inProgress.key;

    const notStarted = steps.find((s) => s.status === 'NOT_STARTED');
    if (notStarted) return notStarted.key;

    return null;
  }

  async initializeProgress(merchantId: string): Promise<void> {
    const existing = await this.progressRepository.findOne({
      where: { merchantId },
    });

    if (existing) return;

    const merchant = await this.merchantRepository.findOne({
      where: { id: merchantId },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const progress = new MerchantOnboardingProgress();
    progress.merchantId = merchantId;
    progress.merchant = merchant;
    progress.steps = ONBOARDING_STEPS.map((step) => ({
      key: step,
      status: step === 'ACCOUNT_CREATED' ? 'COMPLETED' : 'NOT_STARTED',
      completedAt: step === 'ACCOUNT_CREATED' ? new Date() : null,
      blockedReason: null,
    }));
    progress.completedStepCount = 1;
    progress.totalStepCount = ONBOARDING_STEPS.length;
    progress.completionPercentage = (
      (1 / ONBOARDING_STEPS.length) *
      100
    ).toFixed(2);
    progress.lastProgressAt = new Date();
    progress.isStuck = false;
    progress.daysInCurrentStep = 0;

    await this.progressRepository.save(progress);
  }

  async markStepCompleted(
    merchantId: string,
    step: OnboardingStepKey,
  ): Promise<void> {
    const progress = await this.progressRepository.findOne({
      where: { merchantId },
    });

    if (!progress) {
      await this.initializeProgress(merchantId);
      return this.markStepCompleted(merchantId, step);
    }

    const stepIndex = progress.steps.findIndex((s) => s.key === step);
    if (stepIndex === -1) return;

    if (progress.steps[stepIndex].status === 'COMPLETED') return;

    progress.steps[stepIndex].status = 'COMPLETED';
    progress.steps[stepIndex].completedAt = new Date();

    const completedCount = progress.steps.filter(
      (s) => s.status === 'COMPLETED',
    ).length;
    progress.completedStepCount = completedCount;
    progress.completionPercentage = (
      (completedCount / progress.totalStepCount) *
      100
    ).toFixed(2);

    progress.lastProgressAt = new Date();
    progress.isStuck = false;

    await this.progressRepository.save(progress);

    // Invalidate cache
    await this.cacheManager.del('onboarding:funnel:stats');
  }
}
