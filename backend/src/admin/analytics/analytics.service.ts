import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CacheService } from '../../cache/cache.service';
import { User, KycStatus } from '../../users/entities/user.entity';
import { Transaction, TransactionStatus } from '../../transactions/entities/transaction.entity';
import { WaitlistEntry } from '../../waitlist/entities/waitlist-entry.entity';
import {
  DashboardStatsDto,
  UserGrowthResponseDto,
  VolumeHistoryResponseDto,
  FeeRevenueResponseDto,
  ConversionFunnelDto,
  TierDistributionDto,
} from './dto';

const ANALYTICS_QUEUE = 'analytics';

const DASHBOARD_CACHE_KEY = 'analytics:dashboard';
const DASHBOARD_TTL = 60; // 60s

const GROWTH_CACHE_KEY = (days: number) => `analytics:growth:${days}`;
const GROWTH_TTL = 300; // 5min

const VOLUME_CACHE_KEY = (days: number) => `analytics:volume:${days}`;
const VOLUME_TTL = 300;

const FEES_CACHE_KEY = (days: number) => `analytics:fees:${days}`;
const FEES_TTL = 300;

const FUNNEL_CACHE_KEY = 'analytics:funnel';
const FUNNEL_TTL = 600;

const TIERS_CACHE_KEY = 'analytics:tiers';
const TIERS_TTL = 600;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Transaction)
    private txRepo: Repository<Transaction>,
    @InjectRepository(WaitlistEntry)
    private waitlistRepo: Repository<WaitlistEntry>,
    private cacheService: CacheService,
    @InjectQueue(ANALYTICS_QUEUE)
    private analyticsQueue: Queue,
  ) {}

  async getDashboardStats(): Promise<DashboardStatsDto> {
    const cached = await this.cacheService.get<DashboardStatsDto>(DASHBOARD_CACHE_KEY);
    if (cached) return cached;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      dauToday,
      totalTxVolume,
      txVolumeToday,
      totalFees,
      feesToday,
      totalMerchants,
      waitlistSize,
      waitlistGrowthToday,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { createdAt: Raw((alias) => `${alias} >= :today`, { today }) } }),
      this.userRepo.count({ where: { createdAt: Raw((alias) => `${alias} >= :weekAgo`, { weekAgo }) } }),
      this.cacheService.getActiveUsersTodayCount(),
      this.getTotalVolume(),
      this.getDailyVolume(today),
      this.getTotalFees(),
      this.getDailyFees(today),
      this.userRepo.count({ where: { isMerchant: true } }),
      this.waitlistRepo.count(),
      this.getDailyWaitlistGrowth(today),
    ]);

    // Active merchants: isMerchant && isActive && had tx today (query users with tx today)
    const activeMerchantsToday = await this.getActiveMerchantsToday(today);

    const stats: DashboardStatsDto = {
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      dauToday,
      totalTransactionVolumeUsdc: totalTxVolume,
      transactionVolumeToday: txVolumeToday,
      totalFeesCollectedUsdc: totalFees,
      feesToday: feesToday,
      totalMerchants,
      activeMerchantsToday,
      waitlistSize,
      waitlistGrowthToday,
    };

    await this.cacheService.set(DASHBOARD_CACHE_KEY, stats, DASHBOARD_TTL);
    return stats;
  }

  async getUserGrowth(days: number = 30): Promise<UserGrowthResponseDto> {
    const key = GROWTH_CACHE_KEY(days);
    const cached = await this.cacheService.get<UserGrowthResponseDto['data']>(key);
    if (cached) return { data: cached };

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const data = await this.userRepo
      .createQueryBuilder('user')
      .select("DATE_TRUNC('day', user.createdAt)::date", 'date')
      .addSelect('COUNT(user.id)', 'newUsers')
      .where('user.createdAt >= :fromDate', { fromDate })
      .groupBy("DATE_TRUNC('day', user.createdAt)")
      .orderBy('date', 'DESC')
      .getRawMany();

    const result = data.map((row: any) => ({
      date: row.date,
      newUsers: parseInt(row.newusers),
    }));

    await this.cacheService.set(key, result, GROWTH_TTL);
    return { data: result };
  }

  async getVolumeHistory(days: number = 30): Promise<VolumeHistoryResponseDto> {
    const key = VOLUME_CACHE_KEY(days);
    const cached = await this.cacheService.get<VolumeHistoryResponseDto['data']>(key);
    if (cached) return { data: cached };

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const data = await this.txRepo
      .createQueryBuilder('tx')
      .select("DATE_TRUNC('day', tx.createdAt)::date", 'date')
      .addSelect("SUM(tx.amountUsdc::numeric)", 'volumeUsdc')
      .where('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt >= :fromDate', { fromDate })
      .groupBy("DATE_TRUNC('day', tx.createdAt)")
      .orderBy('date', 'DESC')
      .getRawMany();

    const result = data.map((row: any) => ({
      date: row.date,
      volumeUsdc: row.volumeusdc?.toFixed(2) || '0.00',
    }));

    await this.cacheService.set(key, result, VOLUME_TTL);
    return { data: result };
  }

  async getFeeRevenue(days: number = 30): Promise<FeeRevenueResponseDto> {
    const key = FEES_CACHE_KEY(days);
    const cached = await this.cacheService.get<FeeRevenueResponseDto['data']>(key);
    if (cached) return { data: cached };

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const data = await this.txRepo
      .createQueryBuilder('tx')
      .select("DATE_TRUNC('day', tx.createdAt)::date", 'date')
      .addSelect("SUM(CASE WHEN tx.type IN ('transfer_out', 'transfer_in') THEN (tx.fee::numeric) ELSE 0 END)", 'transferFees')
      .addSelect("SUM(CASE WHEN tx.type = 'withdrawal' THEN (tx.fee::numeric) ELSE 0 END)", 'withdrawalFees')
      .addSelect("SUM(CASE WHEN tx.type IN ('paylink_sent', 'paylink_received') THEN (tx.fee::numeric) ELSE 0 END)", 'paylinkFees')
      .addSelect("SUM(tx.fee::numeric)", 'totalFees')
      .where('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('tx.createdAt >= :fromDate', { fromDate })
      .groupBy("DATE_TRUNC('day', tx.createdAt)")
      .orderBy('date', 'DESC')
      .getRawMany();

    const result = data.map((row: any) => ({
      date: row.date,
      transferFees: row.transferfees?.toFixed(2) || '0.00',
      withdrawalFees: row.withdrawalfess?.toFixed(2) || '0.00',
      paylinkFees: row.paylinkfees?.toFixed(2) || '0.00',
      totalFees: row.totalfees?.toFixed(2) || '0.00',
    }));

    await this.cacheService.set(key, result, FEES_TTL);
    return { data: result };
  }

  async getConversionFunnel(): Promise<ConversionFunnelDto> {
    const cached = await this.cacheService.get<ConversionFunnelDto>(FUNNEL_CACHE_KEY);
    if (cached) return cached;

    const [
      waitlistCount,
      registeredCount,
      emailVerifiedCount,
      pinSetCount,
      firstTxCount,
    ] = await Promise.all([
      this.waitlistRepo.count(),
      this.userRepo.count(),
      this.userRepo.count({ where: { emailVerified: true } }),
      this.userRepo.count({ where: Raw('pinHash IS NOT NULL') }),
      // Users with first completed transaction
      this.userRepo.createQueryBuilder('u')
        .innerJoin(Transaction, 'tx', 'tx.userId = u.id')
        .where('tx.status = :status', { status: TransactionStatus.COMPLETED })
        .groupBy('u.id')
        .getCount(),
    ]);

    const total = waitlistCount;
    const stages: FunnelStageDto[] = [
      { name: 'waitlist', count: waitlistCount, percent: total ? Math.round((waitlistCount / total) * 100) : 0 },
      { name: 'registered', count: registeredCount, percent: total ? Math.round((registeredCount / total) * 100) : 0 },
      { name: 'email_verified', count: emailVerifiedCount, percent: total ? Math.round((emailVerifiedCount / total) * 100) : 0 },
      { name: 'pin_set', count: pinSetCount, percent: total ? Math.round((pinSetCount / total) * 100) : 0 },
      { name: 'first_transaction', count: firstTxCount, percent: total ? Math.round((firstTxCount / total) * 100) : 0 },
    ];

    const result: ConversionFunnelDto = { stages, total };

    await this.cacheService.set(FUNNEL_CACHE_KEY, result, FUNNEL_TTL);
    return result;
  }

  async getTierDistribution(): Promise<TierDistributionDto> {
    const cached = await this.cacheService.get<TierDistributionDto['tiers']>(TIERS_CACHE_KEY);
    if (cached) return { tiers: cached };

    const tierCounts = await this.userRepo
      .createQueryBuilder('u')
      .select('u.tier', 'tier')
      .addSelect('COUNT(u.id)', 'count')
      .groupBy('u.tier')
      .getRawMany();

    const totalUsers = await this.userRepo.count();
    const tiers = tierCounts.map((row: any) => {
      const count = parseInt(row.count);
      return {
        tier: row.tier,
        count,
        percent: totalUsers ? Math.round((count / totalUsers) * 10) / 10 : 0,
      };
    });

    await this.cacheService.set(TIERS_CACHE_KEY, tiers, TIERS_TTL);
    return { tiers };
  }

  // ── Helpers ────────────────────────────────────────────────────

  private async getTotalVolume(): Promise<string> {
    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select('SUM(tx.amountUsdc::numeric)', 'total')
      .where('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .getRawOne();
    return result?.total?.toFixed(2) || '0.00';
  }

  private async getDailyVolume(date: Date): Promise<string> {
    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select('SUM(tx.amountUsdc::numeric)', 'total')
      .where('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('DATE_TRUNC("day", tx.createdAt) = :date', { date })
      .getRawOne();
    return result?.total?.toFixed(2) || '0.00';
  }

  private async getTotalFees(): Promise<string> {
    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select('SUM(tx.fee::numeric)', 'total')
      .where('tx.status = :status AND tx.fee IS NOT NULL', { status: TransactionStatus.COMPLETED })
      .getRawOne();
    return result?.total?.toFixed(2) || '0.00';
  }

  private async getDailyFees(date: Date): Promise<string> {
    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select('SUM(tx.fee::numeric)', 'total')
      .where('tx.status = :status AND tx.fee IS NOT NULL', { status: TransactionStatus.COMPLETED })
      .andWhere('DATE_TRUNC("day", tx.createdAt) = :date', { date })
      .getRawOne();
    return result?.total?.toFixed(2) || '0.00';
  }

  private async getDailyWaitlistGrowth(date: Date): Promise<number> {
    return this.waitlistRepo.count({
      where: { createdAt: Raw((alias) => `${alias} >= :today`, { today: date }) },
    });
  }

  private async getActiveMerchantsToday(date: Date): Promise<number> {
    // Merchants who are active and had a transaction today
    return this.userRepo
      .createQueryBuilder('u')
      .innerJoin(Transaction, 'tx', 'tx.userId = u.id')
      .where('u.isMerchant = true')
      .andWhere('u.isActive = true')
      .andWhere('tx.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('DATE_TRUNC("day", tx.createdAt) = :date', { date })
      .groupBy('u.id')
      .getCount();
  }

  async invalidateDashboardCache(): Promise<void> {
    await this.cacheService.delPattern('analytics:*');
    // Trigger immediate recompute
    await this.analyticsQueue.add('update-dashboard-stats', {}, { delay: 0 });
  }

  async scheduleDashboardUpdate(): Promise<void> {
    await this.analyticsQueue.add(
      'update-dashboard-stats',
      {},
      { repeat: { cron: '*/5 * * * *' } },
    );
  }
}

