import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { TierConfig } from '../tier-config/entities/tier-config.entity';
import { Transaction, TransactionType } from '../transactions/entities/transaction.entity';
import { YieldEntry } from './entities/yield-entry.entity';
import { CacheService } from '../cache/cache.service';
import { EarningsDashboardDto } from './dto/earnings-dashboard.dto';
import { YieldHistoryDto } from './dto/yield-history.dto';
import { ProjectionsDto, ProjectionPeriod } from './dto/projections.dto';

const CACHE_TTL_SECONDS = 60;
const PROJECTION_DAYS = [30, 90, 180, 365];

@Injectable()
export class EarningsService {
  private readonly logger = new Logger(EarningsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(TierConfig)
    private readonly tierRepo: Repository<TierConfig>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,

    @InjectRepository(YieldEntry)
    private readonly yieldRepo: Repository<YieldEntry>,

    private readonly cacheService: CacheService,
  ) {}

  // ── Dashboard ──────────────────────────────────────────────────

  async getDashboard(userId: string): Promise<EarningsDashboardDto> {
    const cacheKey = `earnings:${userId}`;

    // 1. Try cache first
    const cached = await this.cacheService.get<EarningsDashboardDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return cached;
    }

    // 2. Load user + tier config
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const tierConfig = await this.tierRepo.findOne({ where: { tier: user.tier } });
    if (!tierConfig) throw new NotFoundException('Tier configuration not found');

    // 3. Sum staked balance (sum of completed stake minus completed unstake)
    const stakeResult = await this.txRepo
      .createQueryBuilder('tx')
      .select(
        `COALESCE(SUM(CASE WHEN tx.type = :stakeType THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN tx.type = :unstakeType THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)`,
        'staked',
      )
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.type IN (:...types)', { types: [TransactionType.STAKE, TransactionType.UNSTAKE] })
      .setParameter('stakeType', TransactionType.STAKE)
      .setParameter('unstakeType', TransactionType.UNSTAKE)
      .getRawOne();

    const stakedBalance = parseFloat(stakeResult?.staked || '0');

    // 4. Sum liquid balance (deposits + transfers_in - transfers_out - withdrawals - staked)
    const liquidResult = await this.txRepo
      .createQueryBuilder('tx')
      .select(
        `COALESCE(SUM(CASE WHEN tx.type IN (:...creditTypes) THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN tx.type IN (:...debitTypes) THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)`,
        'liquid',
      )
      .where('tx.user_id = :userId', { userId })
      .setParameter('creditTypes', [TransactionType.DEPOSIT, TransactionType.TRANSFER_IN, TransactionType.YIELD_CREDIT])
      .setParameter('debitTypes', [TransactionType.WITHDRAWAL, TransactionType.TRANSFER_OUT])
      .getRawOne();

    const liquidBalance = parseFloat(liquidResult?.liquid || '0') - stakedBalance;

    // 5. Sum total yield earned (yield_credit transactions only)
    const yieldResult = await this.txRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(CAST(tx.amount_usdc AS NUMERIC)), 0)', 'totalYield')
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.type = :type', { type: TransactionType.YIELD_CREDIT })
      .getRawOne();

    const totalYieldEarned = parseFloat(yieldResult?.totalYield || '0');

    // 6. Compute APY and projections
    const apy = parseFloat(tierConfig.yieldApyPercent);
    const projectedDaily = (stakedBalance * (apy / 100)) / 365;
    const projectedMonthly = (stakedBalance * (apy / 100) * 30) / 365;

    // 7. Lockup / unstake logic
    const lastStakeTx = await this.txRepo.findOne({
      where: { userId, type: TransactionType.STAKE },
      order: { createdAt: 'DESC' },
    });

    const lockupDays = tierConfig.stakeLockupDays;
    let canUnstakeNow = true;
    let nextUnstakeDate: string | null = null;

    if (lastStakeTx && lockupDays > 0) {
      const unlockDate = new Date(lastStakeTx.createdAt);
      unlockDate.setDate(unlockDate.getDate() + lockupDays);
      canUnstakeNow = new Date() >= unlockDate;
      if (!canUnstakeNow) {
        nextUnstakeDate = unlockDate.toISOString();
      }
    }

    const dashboard: EarningsDashboardDto = {
      stakedBalanceUsdc: stakedBalance.toFixed(8),
      liquidBalanceUsdc: Math.max(0, liquidBalance).toFixed(8),
      currentApyPercent: tierConfig.yieldApyPercent,
      totalYieldEarnedUsdc: totalYieldEarned.toFixed(8),
      projectedDailyYieldUsdc: projectedDaily.toFixed(8),
      projectedMonthlyYieldUsdc: projectedMonthly.toFixed(8),
      stakeLockupDays: lockupDays,
      canUnstakeNow,
      nextUnstakeDate,
    };

    // 8. Cache the result
    await this.cacheService.set(cacheKey, dashboard, CACHE_TTL_SECONDS);

    return dashboard;
  }

  // ── Yield History ──────────────────────────────────────────────

  async getYieldHistory(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<YieldHistoryDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const skip = (page - 1) * limit;

    const [items, total] = await this.yieldRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // Running total: sum of ALL yield entries for the user
    const runningResult = await this.yieldRepo
      .createQueryBuilder('ye')
      .select('COALESCE(SUM(CAST(ye.amount_usdc AS NUMERIC)), 0)', 'runningTotal')
      .where('ye.user_id = :userId', { userId })
      .getRawOne();

    return {
      items,
      total,
      page,
      limit,
      runningTotalUsdc: parseFloat(runningResult?.runningTotal || '0').toFixed(8),
    };
  }

  // ── Projections ────────────────────────────────────────────────

  async getProjections(
    userId: string,
    additionalStakeUsdc = 0,
  ): Promise<ProjectionsDto> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const tierConfig = await this.tierRepo.findOne({ where: { tier: user.tier } });
    if (!tierConfig) throw new NotFoundException('Tier configuration not found');

    // Get current staked balance
    const stakeResult = await this.txRepo
      .createQueryBuilder('tx')
      .select(
        `COALESCE(SUM(CASE WHEN tx.type = :stakeType THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN tx.type = :unstakeType THEN CAST(tx.amount_usdc AS NUMERIC) ELSE 0 END), 0)`,
        'staked',
      )
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.type IN (:...types)', { types: [TransactionType.STAKE, TransactionType.UNSTAKE] })
      .setParameter('stakeType', TransactionType.STAKE)
      .setParameter('unstakeType', TransactionType.UNSTAKE)
      .getRawOne();

    const stakedBalance = parseFloat(stakeResult?.staked || '0');
    const apy = parseFloat(tierConfig.yieldApyPercent);
    const totalStake = stakedBalance + additionalStakeUsdc;

    const projections: ProjectionPeriod[] = PROJECTION_DAYS.map((days) => ({
      days,
      projectedYieldUsdc: (totalStake * (apy / 100) * (days / 365)).toFixed(8),
    }));

    return {
      currentStakedUsdc: stakedBalance.toFixed(8),
      additionalStakeUsdc: additionalStakeUsdc.toFixed(8),
      currentApyPercent: tierConfig.yieldApyPercent,
      projections,
    };
  }

  // ── Cache invalidation ─────────────────────────────────────────

  async invalidateCache(userId: string): Promise<void> {
    await this.cacheService.del(`earnings:${userId}`);
    this.logger.debug(`Invalidated earnings cache for user ${userId}`);
  }
}
