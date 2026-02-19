import { Injectable, Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Settlement,
  SettlementStatus,
} from '../settlement/entities/settlement.entity';
import { Merchant } from '../database/entities/merchant.entity';
import {
  PaymentRequest,
  PaymentRequestStatus,
} from '../database/entities/payment-request.entity';
import {
  RevenueOverviewResponseDto,
  RevenueSummaryDto,
  ByFeeTypeDto,
  ByTierItemDto,
  ByChainItemDto,
  TrendItemDto,
} from './dto/revenue-overview.dto';
import { RevenueGranularity } from './dto/revenue-overview.dto';

const CACHE_TTL_MS = 60_000; // 1 minute

@Injectable()
export class RevenueOverviewService {
  constructor(
    @InjectRepository(Settlement)
    private readonly settlementRepository: Repository<Settlement>,
    @InjectRepository(PaymentRequest)
    private readonly paymentRequestRepository: Repository<PaymentRequest>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    @Inject('CACHE_MANAGER') private readonly cacheManager: Cache,
  ) {}

  /**
   * Parse period string (e.g. "30d") to [startDate, endDate].
   * endDate = now, startDate = endDate - period days.
   */
  parsePeriod(period: string): { startDate: Date; endDate: Date } {
    const match = period.match(/^(\d+)d$/);
    const days = match ? Math.min(365, Math.max(1, parseInt(match[1], 10))) : 30;
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);
    return { startDate, endDate };
  }

  /**
   * Previous equal-length window: [startDate - (end - start), startDate].
   */
  previousWindow(
    startDate: Date,
    endDate: Date,
  ): { startDate: Date; endDate: Date } {
    const length = endDate.getTime() - startDate.getTime();
    return {
      startDate: new Date(startDate.getTime() - length),
      endDate: new Date(startDate.getTime()),
    };
  }

  async getRevenueOverview(
    period: string,
    granularity: RevenueGranularity,
  ): Promise<RevenueOverviewResponseDto> {
    const cacheKey = `revenue-overview:${period}:${granularity}`;
    const cached = await this.cacheManager.get<RevenueOverviewResponseDto>(cacheKey);
    if (cached) return cached;

    const { startDate, endDate } = this.parsePeriod(period);
    const prev = this.previousWindow(startDate, endDate);

    const [
      transactionFeeRevenue,
      settlementFeeRevenue,
      transactionCount,
      prevTotalRevenue,
      byTierRaw,
      byChainRaw,
      trendRaw,
    ] = await Promise.all([
      this.getTransactionFeeRevenue(startDate, endDate),
      this.getSettlementFeeRevenue(startDate, endDate),
      this.getTransactionCountInPeriod(startDate, endDate),
      this.getTotalRevenueForPeriod(prev.startDate, prev.endDate),
      this.getRevenueByTier(startDate, endDate),
      this.getRevenueByChain(startDate, endDate),
      this.getTrend(startDate, endDate, granularity),
    ]);

    const totalRevenueUsd = transactionFeeRevenue + settlementFeeRevenue;
    const prevTotal = prevTotalRevenue;
    const vsPct =
      prevTotal > 0
        ? ((totalRevenueUsd - prevTotal) / prevTotal) * 100
        : totalRevenueUsd > 0
          ? 100
          : 0;
    const vsLastPeriodStr =
      vsPct >= 0 ? `+${vsPct.toFixed(1)}%` : `${vsPct.toFixed(1)}%`;

    const transactionPct =
      totalRevenueUsd > 0
        ? ((transactionFeeRevenue / totalRevenueUsd) * 100).toFixed(1)
        : '0.0';
    const settlementPct =
      totalRevenueUsd > 0
        ? ((settlementFeeRevenue / totalRevenueUsd) * 100).toFixed(1)
        : '0.0';

    const avgFeePerTx =
      transactionCount > 0 ? totalRevenueUsd / transactionCount : 0;

    const summary: RevenueSummaryDto = {
      totalRevenueUsd: totalRevenueUsd.toFixed(2),
      transactionFeeRevenueUsd: transactionFeeRevenue.toFixed(2),
      settlementFeeRevenueUsd: settlementFeeRevenue.toFixed(2),
      transactionCount,
      averageFeePerTransactionUsd: avgFeePerTx.toFixed(2),
      vsLastPeriod: { totalRevenueUsd: vsLastPeriodStr },
    };

    const byFeeType: ByFeeTypeDto = {
      transactionFee: {
        revenueUsd: transactionFeeRevenue.toFixed(2),
        percentage: transactionPct,
      },
      settlementFee: {
        revenueUsd: settlementFeeRevenue.toFixed(2),
        percentage: settlementPct,
      },
    };

    const byTier: Record<string, ByTierItemDto> = {};
    for (const row of byTierRaw) {
      const tier = row.tier || 'STARTER';
      byTier[tier] = {
        revenueUsd: parseFloat(row.revenueUsd || 0).toFixed(2),
        transactionCount: parseInt(row.transactionCount || '0', 10),
      };
    }
    if (Object.keys(byTier).length === 0) {
      byTier['STARTER'] = { revenueUsd: '0.00', transactionCount: 0 };
    }

    const totalByChain = byChainRaw.reduce(
      (s, r) => s + parseFloat(r.revenueUsd || 0),
      0,
    );
    const byChain = byChainRaw.map((r) => ({
      chain: (r.chain || 'unknown').toLowerCase(),
      revenueUsd: parseFloat(r.revenueUsd || 0).toFixed(2),
      percentage:
        totalByChain > 0
          ? ((parseFloat(r.revenueUsd || 0) / totalByChain) * 100).toFixed(1)
          : '0.0',
    }));

    const trend: TrendItemDto[] = trendRaw.map((r) => ({
      period: r.period,
      revenueUsd: parseFloat(r.revenueUsd || 0).toFixed(2),
      transactionCount: parseInt(r.transactionCount || '0', 10),
    }));

    const response: RevenueOverviewResponseDto = {
      period,
      summary,
      byFeeType,
      byTier,
      byChain,
      trend,
    };

    await this.cacheManager.set(cacheKey, response, CACHE_TTL_MS);
    return response;
  }

  private async getTransactionFeeRevenue(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const q = await this.paymentRequestRepository
      .createQueryBuilder('pr')
      .select('COALESCE(SUM(pr.fee_amount), 0)', 'total')
      .where('pr.status = :status', { status: PaymentRequestStatus.COMPLETED })
      .andWhere('pr.completed_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();
    return parseFloat(q?.total || '0') || 0;
  }

  private async getSettlementFeeRevenue(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const q = await this.settlementRepository
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.fee_amount), 0)', 'total')
      .where('s.status = :status', { status: SettlementStatus.COMPLETED })
      .andWhere('s.settled_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();
    return parseFloat(q?.total || '0') || 0;
  }

  private async getTransactionCountInPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const q = await this.paymentRequestRepository
      .createQueryBuilder('pr')
      .select('COUNT(pr.id)', 'total')
      .where('pr.status = :status', { status: PaymentRequestStatus.COMPLETED })
      .andWhere('pr.completed_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();
    return parseInt(q?.total || '0', 10) || 0;
  }

  private async getTotalRevenueForPeriod(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const [txFee, setFee] = await Promise.all([
      this.getTransactionFeeRevenue(startDate, endDate),
      this.getSettlementFeeRevenue(startDate, endDate),
    ]);
    return txFee + setFee;
  }

  private async getRevenueByTier(
    startDate: Date,
    endDate: Date,
  ): Promise<{ tier: string; revenueUsd: string; transactionCount: string }[]> {
    const qb = this.settlementRepository
      .createQueryBuilder('s')
      .innerJoin('s.merchant', 'm')
      .select(
        "COALESCE(m.settings->>'tier', 'STARTER')",
        'tier',
      )
      .addSelect('SUM(s.fee_amount)', 'revenueUsd')
      .addSelect('COUNT(s.id)', 'transactionCount')
      .where('s.status = :status', { status: SettlementStatus.COMPLETED })
      .andWhere('s.settled_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy("m.settings->>'tier'");

    try {
      const rows = await qb.getRawMany();
      return rows.map((r) => ({
        tier: r.tier || 'STARTER',
        revenueUsd: String(r.revenueUsd ?? 0),
        transactionCount: String(r.transactionCount ?? 0),
      }));
    } catch {
      return [];
    }
  }

  private async getRevenueByChain(
    startDate: Date,
    endDate: Date,
  ): Promise<{ chain: string; revenueUsd: string }[]> {
    return this.settlementRepository
      .createQueryBuilder('s')
      .innerJoin('s.paymentRequest', 'pr')
      .select('COALESCE(pr.stellar_network, \'unknown\')', 'chain')
      .addSelect('SUM(s.fee_amount) + SUM(pr.fee_amount)', 'revenueUsd')
      .where('s.status = :status', { status: SettlementStatus.COMPLETED })
      .andWhere('s.settled_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy('pr.stellar_network')
      .getRawMany()
      .then((rows) =>
        rows.map((r) => ({
          chain: r.chain || 'unknown',
          revenueUsd: String(r.revenueUsd ?? 0),
        })),
      )
      .catch(() => []);
  }

  private getTrunc(g: RevenueGranularity): string {
    switch (g) {
      case RevenueGranularity.WEEK:
        return 'week';
      case RevenueGranularity.MONTH:
        return 'month';
      default:
        return 'day';
    }
  }

  private async getTrend(
    startDate: Date,
    endDate: Date,
    granularity: RevenueGranularity,
  ): Promise<{ period: string; revenueUsd: string; transactionCount: string }[]> {
    const trunc = this.getTrunc(granularity);
    const format =
      granularity === RevenueGranularity.MONTH
        ? 'YYYY-MM'
        : granularity === RevenueGranularity.WEEK
          ? 'IYYY-IW'
          : 'YYYY-MM-DD';

    const rows = await this.settlementRepository
      .createQueryBuilder('s')
      .innerJoin('s.paymentRequest', 'pr')
      .select(
        `TO_CHAR(DATE_TRUNC('${trunc}', s.settled_at), '${format}')`,
        'period',
      )
      .addSelect(
        'COALESCE(SUM(s.fee_amount), 0) + COALESCE(SUM(pr.fee_amount), 0)',
        'revenueUsd',
      )
      .addSelect('COUNT(s.id)', 'transactionCount')
      .where('s.status = :status', { status: SettlementStatus.COMPLETED })
      .andWhere('s.settled_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .groupBy(`DATE_TRUNC('${trunc}', s.settled_at)`)
      .orderBy('period', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      period: r.period,
      revenueUsd: String(r.revenueUsd ?? 0),
      transactionCount: String(r.transactionCount ?? 0),
    }));
  }

  async getEstimatedExportRows(period: string): Promise<number> {
    const { startDate, endDate } = this.parsePeriod(period);
    const q = await this.settlementRepository
      .createQueryBuilder('s')
      .select('COUNT(s.id)', 'total')
      .where('s.status = :status', { status: SettlementStatus.COMPLETED })
      .andWhere('s.settled_at BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne();
    return parseInt(q?.total || '0', 10) || 0;
  }
}
