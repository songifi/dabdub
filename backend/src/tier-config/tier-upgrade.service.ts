import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TierConfig, TierName } from './entities/tier-config.entity';
import { User, KycStatus } from '../users/entities/user.entity';
import { TierService } from './tier.service';
import { EmailService } from '../email/email.service';
import {
  TierBenefitsDto,
  TierBenefitsRowDto,
  TierBenefitsTableDto,
  TierUpgradeRequirementsDto,
} from './dto/tier-benefits.dto';

const TIER_RANK: Record<TierName, number> = {
  [TierName.SILVER]: 0,
  [TierName.GOLD]: 1,
  [TierName.BLACK]: 2,
};

function tierRank(tier: TierName): number {
  return TIER_RANK[tier];
}

function virtualCardAccessForTier(tier: TierName): boolean {
  return tierRank(tier) >= tierRank(TierName.GOLD);
}

@Injectable()
export class TierUpgradeService {
  constructor(
    @InjectRepository(TierConfig)
    private readonly tierRepo: Repository<TierConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tierService: TierService,
    private readonly emailService: EmailService,
  ) {}

  async getUpgradeRequirements(
    userId: string,
    targetTier: TierName,
  ): Promise<TierUpgradeRequirementsDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const currentCfg = await this.requireConfigForTier(user.tier);
    const targetCfg = await this.requireConfigForTier(targetTier);

    const kycRequired =
      tierRank(targetTier) > tierRank(TierName.SILVER) &&
      user.kycStatus !== KycStatus.APPROVED;

    return {
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      kycRequired,
      kycStatus: user.kycStatus,
      currentTier: user.tier,
      targetTier,
      benefits: this.buildBenefitsDto(currentCfg, targetCfg),
    };
  }

  async initiateUpgrade(
    userId: string,
    targetTier: TierName,
  ): Promise<{ status: 'upgraded'; tier: TierName }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.tier === targetTier) {
      throw new BadRequestException(
        'You are already on this tier; choose a higher tier to upgrade.',
      );
    }

    if (tierRank(targetTier) < tierRank(user.tier)) {
      throw new BadRequestException('Tier downgrades are not supported');
    }

    if (!user.emailVerified || !user.phoneVerified) {
      throw new BadRequestException(
        'Verify your email and phone before upgrading tiers',
      );
    }

    if (user.kycStatus === KycStatus.APPROVED) {
      await this.tierService.upgradeTier(userId, targetTier);
      await this.userRepo.update(userId, { pendingTierUpgrade: null });
      await this.sendTierUpgradedEmail(userId, targetTier);
      return { status: 'upgraded', tier: targetTier };
    }

    await this.userRepo.update(userId, { pendingTierUpgrade: targetTier });

    if (user.kycStatus === KycStatus.PENDING) {
      throw new BadRequestException(
        'KYC review in progress, upgrade will be automatic on approval',
      );
    }

    throw new BadRequestException({
      message: 'Please complete KYC verification first',
      redirectTo: '/kyc',
    });
  }

  /**
   * Called after KYC is marked approved. Applies pending target tier if set.
   * @returns true when a pending upgrade was applied
   */
  async checkAutoUpgrade(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.pendingTierUpgrade) return false;

    const target = user.pendingTierUpgrade;
    await this.tierService.upgradeTier(userId, target);
    await this.userRepo.update(userId, { pendingTierUpgrade: null });
    await this.sendTierUpgradedEmail(userId, target);
    return true;
  }

  /** When KYC is approved and there was no pending in-app upgrade target. */
  async applySubmissionTierAfterKyc(
    userId: string,
    submissionTargetTier: TierName,
  ): Promise<void> {
    await this.tierService.upgradeTier(userId, submissionTargetTier);
    await this.sendTierUpgradedEmail(userId, submissionTargetTier);
  }

  async getUpgradeStatus(userId: string): Promise<{
    pendingTargetTier: TierName | null;
    blockingReasons: string[];
    requirements: TierUpgradeRequirementsDto | null;
  }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const pendingTargetTier = user.pendingTierUpgrade;
    if (!pendingTargetTier) {
      return {
        pendingTargetTier: null,
        blockingReasons: [],
        requirements: null,
      };
    }

    const requirements = await this.getUpgradeRequirements(
      userId,
      pendingTargetTier,
    );
    const blockingReasons = this.blockingReasonsFromRequirements(requirements);

    return { pendingTargetTier, blockingReasons, requirements };
  }

  async getPublicTierBenefitsTable(): Promise<TierBenefitsTableDto> {
    const configs = await this.tierRepo.find({
      where: { isActive: true },
      order: { tier: 'ASC' },
    });

    const byTier = new Map<TierName, TierConfig>();
    for (const c of configs) {
      byTier.set(c.tier, c);
    }

    const tiers: TierBenefitsRowDto[] = [TierName.SILVER, TierName.GOLD, TierName.BLACK].map(
      (name) => {
        const cfg = byTier.get(name);
        if (!cfg) {
          return {
            tier: name,
            dailyTransferLimitUsdc: '0',
            monthlyTransferLimitUsdc: '0',
            feeDiscountPercent: 0,
            yieldApyPercent: '0.00',
            minStakeAmountUsdc: '0',
            virtualCardAccess: virtualCardAccessForTier(name),
          };
        }
        return {
          tier: name,
          dailyTransferLimitUsdc: cfg.dailyTransferLimitUsdc,
          monthlyTransferLimitUsdc: cfg.monthlyTransferLimitUsdc,
          feeDiscountPercent: cfg.feeDiscountPercent,
          yieldApyPercent: cfg.yieldApyPercent,
          minStakeAmountUsdc: cfg.minStakeAmountUsdc,
          virtualCardAccess: virtualCardAccessForTier(name),
        };
      },
    );

    return { tiers };
  }

  async sendTierUpgradedEmail(
    userId: string,
    newTier: TierName,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    const cfg = await this.tierRepo.findOne({ where: { tier: newTier } });
    const benefitsSummary = cfg
      ? {
          dailyTransferLimitUsdc: cfg.dailyTransferLimitUsdc,
          monthlyTransferLimitUsdc: cfg.monthlyTransferLimitUsdc,
          feeDiscountPercent: cfg.feeDiscountPercent,
          yieldApyPercent: cfg.yieldApyPercent,
          minStakeAmountUsdc: cfg.minStakeAmountUsdc,
          virtualCardAccess: virtualCardAccessForTier(newTier),
        }
      : { tier: newTier };

    await this.emailService
      .queue(user.email, 'tier-upgraded', {
        tier: newTier,
        benefitsSummary,
      })
      .catch(() => undefined);
  }

  private blockingReasonsFromRequirements(
    r: TierUpgradeRequirementsDto,
  ): string[] {
    const reasons: string[] = [];
    if (!r.emailVerified) reasons.push('email_not_verified');
    if (!r.phoneVerified) reasons.push('phone_not_verified');
    if (r.kycRequired) reasons.push('kyc_not_approved');
    return reasons;
  }

  private async requireConfigForTier(tier: TierName): Promise<TierConfig> {
    const cfg = await this.tierRepo.findOne({ where: { tier, isActive: true } });
    if (!cfg) throw new NotFoundException(`Tier configuration not found for ${tier}`);
    return cfg;
  }

  private buildBenefitsDto(
    current: TierConfig,
    target: TierConfig,
  ): TierBenefitsDto {
    return {
      dailyTransferLimitUsdc: {
        current: current.dailyTransferLimitUsdc,
        target: target.dailyTransferLimitUsdc,
      },
      monthlyTransferLimitUsdc: {
        current: current.monthlyTransferLimitUsdc,
        target: target.monthlyTransferLimitUsdc,
      },
      feeDiscountPercent: {
        current: current.feeDiscountPercent,
        target: target.feeDiscountPercent,
      },
      yieldApyPercent: {
        current: current.yieldApyPercent,
        target: target.yieldApyPercent,
      },
      minStakeAmountUsdc: {
        current: current.minStakeAmountUsdc,
        target: target.minStakeAmountUsdc,
      },
      virtualCardAccess: {
        current: virtualCardAccessForTier(current.tier),
        target: virtualCardAccessForTier(target.tier),
      },
    };
  }
}
