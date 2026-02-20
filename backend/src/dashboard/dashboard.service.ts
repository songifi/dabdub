import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionStatus } from '../transactions/transactions.enums';
import { Merchant } from '../database/entities/merchant.entity';
import {
  MerchantStatus,
  KycStatus,
} from '../database/entities/merchant.entity';
import {
  Settlement,
  SettlementStatus,
} from '../settlement/entities/settlement.entity';
import { RedisService } from '../common/redis';
import { RedisKeys } from '../common/redis';
import type {
  DashboardOverviewResponseDto,
  DashboardAlertDto,
} from './dto/dashboard-overview-response.dto';
import type { DashboardPeriod } from './dto/dashboard-overview-query.dto';

const PERIOD_HOURS: Record<DashboardPeriod, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
  '90d': 24 * 90,
};

const CACHE_TTL_SECONDS = 60;
const STALE_TTL_SECONDS = 300;

function toPercentChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100.0%' : '0.0%';
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function toFixed2(n: number): string {
  return Number(n).toFixed(2);
}

export interface AlertThresholds {
  failedTransactionRatePercent?: number;
  pendingSettlementCount?: number;
  failedSettlementCount?: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Merchant)
    private readonly merchantRepo: Repository<Merchant>,
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    private readonly redis: RedisService,
  ) {}

  private periodToRange(period: DashboardPeriod): {
    start: Date;
    end: Date;
    previousStart: Date;
    previousEnd: Date;
  } {
    const end = new Date();
    const hours = PERIOD_HOURS[period];
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    const previousEnd = new Date(start.getTime());
    const previousStart = new Date(previousEnd.getTime() - hours * 60 * 60 * 1000);
    return { start, end, previousStart, previousEnd };
  }

  async getOverview(
    period: DashboardPeriod = '24h',
    res?: { setHeader: (name: string, value: string) => void },
  ): Promise<DashboardOverviewResponseDto> {
    const cacheKey = RedisKeys.dashboardOverview(period);
    const staleKey = `${cacheKey}:stale`;

    const cached = await this.redis.get<DashboardOverviewResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const stale = await this.redis.get<DashboardOverviewResponseDto>(staleKey);
    if (stale && res) {
      res.setHeader('X-Cache-Stale', 'true');
      this.refreshOverview(period).catch(() => {});
      return stale;
    }

    return this.refreshOverview(period);
  }

  private async refreshOverview(
    period: DashboardPeriod,
  ): Promise<DashboardOverviewResponseDto> {
    const cacheKey = RedisKeys.dashboardOverview(period);
    const staleKey = `${cacheKey}:stale`;
    const { start, end, previousStart, previousEnd } = this.periodToRange(period);

    const [
      txCurrent,
      txPrevious,
      merchantCurrent,
      merchantPrevious,
      settlementCurrent,
      settlementPrevious,
      feesCurrent,
      feesPrevious,
      pendingSettlementCount,
    ] = await Promise.all([
      this.getTransactionStats(start, end),
      this.getTransactionStats(previousStart, previousEnd),
      this.getMerchantStats(start, end),
      this.getMerchantStats(previousStart, previousEnd),
      this.getSettlementStats(start, end),
      this.getSettlementStats(previousStart, previousEnd),
      this.getFeesCollected(start, end),
      this.getFeesCollected(previousStart, previousEnd),
      this.getPendingSettlementCount(start, end),
    ]);

    const totalTx = txCurrent.total || 0;
    const confirmedTx = txCurrent.confirmed || 0;
    const successRate =
      totalTx > 0 ? (confirmedTx / totalTx) * 100 : 0;

    const transactions = {
      total: totalTx,
      totalVolumeUsd: toFixed2(txCurrent.totalVolumeUsd),
      successRate: successRate.toFixed(1),
      failed: txCurrent.failed || 0,
      pendingConfirmation: txCurrent.pending || 0,
      pendingSettlement: pendingSettlementCount,
      vsLastPeriod: {
        total: toPercentChange(totalTx, txPrevious.total || 0),
        totalVolumeUsd: toPercentChange(
          txCurrent.totalVolumeUsd,
          txPrevious.totalVolumeUsd || 0,
        ),
      },
    };

    const merchants = {
      total: merchantCurrent.total || 0,
      active: merchantCurrent.active || 0,
      pendingKyc: merchantCurrent.pendingKyc || 0,
      suspended: merchantCurrent.suspended || 0,
      newThisPeriod: merchantCurrent.newThisPeriod || 0,
      vsLastPeriod: {
        newThisPeriod: toPercentChange(
          merchantCurrent.newThisPeriod || 0,
          merchantPrevious.newThisPeriod || 0,
        ),
      },
    };

    const settlements = {
      completedCount: settlementCurrent.completedCount || 0,
      completedVolumeUsd: toFixed2(settlementCurrent.completedVolumeUsd || 0),
      failedCount: settlementCurrent.failedCount || 0,
      pendingCount: settlementCurrent.pendingCount || 0,
      pendingVolumeUsd: toFixed2(settlementCurrent.pendingVolumeUsd || 0),
    };

    const fees = {
      collectedUsd: toFixed2(feesCurrent || 0),
      vsLastPeriod: {
        collectedUsd: toPercentChange(feesCurrent || 0, feesPrevious || 0),
      },
    };

    const alerts = await this.buildAlerts({
      failedTransactionRatePercent: totalTx > 0 ? (transactions.failed / totalTx) * 100 : 0,
      pendingSettlementCount: transactions.pendingSettlement,
      failedSettlementCount: settlements.failedCount,
    });

    const payload: DashboardOverviewResponseDto = {
      period,
      generatedAt: new Date().toISOString(),
      transactions,
      merchants,
      settlements,
      fees,
      alerts,
    };

    await this.redis.set(cacheKey, payload, CACHE_TTL_SECONDS);
    await this.redis.set(staleKey, payload, STALE_TTL_SECONDS);

    return payload;
  }

  private async getTransactionStats(
    start: Date,
    end: Date,
  ): Promise<{
    total: number;
    confirmed: number;
    failed: number;
    pending: number;
    totalVolumeUsd: number;
  }> {
    const qb = this.transactionRepo
      .createQueryBuilder('t')
      .where('t.created_at BETWEEN :start AND :end', { start, end });

    const [total, confirmed, failed, pending, sumResult] = await Promise.all([
      qb.clone().getCount(),
      qb
        .clone()
        .andWhere('t.status = :status', { status: TransactionStatus.CONFIRMED })
        .getCount(),
      qb
        .clone()
        .andWhere('t.status = :status', { status: TransactionStatus.FAILED })
        .getCount(),
      qb
        .clone()
        .andWhere('t.status = :status', { status: TransactionStatus.PENDING })
        .getCount(),
      this.transactionRepo
        .createQueryBuilder('t')
        .select('COALESCE(SUM(CAST(t.usd_value AS DECIMAL)), 0)', 'sum')
        .where('t.created_at BETWEEN :start AND :end', { start, end })
        .andWhere('t.status = :status', { status: TransactionStatus.CONFIRMED })
        .getRawOne<{ sum: string }>(),
    ]);

    return {
      total,
      confirmed,
      failed,
      pending,
      totalVolumeUsd: parseFloat(sumResult?.sum || '0') || 0,
    };
  }

  private async getMerchantStats(
    start: Date,
    end: Date,
  ): Promise<{
    total: number;
    active: number;
    pendingKyc: number;
    suspended: number;
    newThisPeriod: number;
  }> {
    const [total, active, pendingKyc, suspended, newThisPeriod] =
      await Promise.all([
        this.merchantRepo.count(),
        this.merchantRepo.count({
          where: { status: MerchantStatus.ACTIVE },
        }),
        this.merchantRepo.count({
          where: {
            kycStatus: In([
              KycStatus.PENDING,
              KycStatus.IN_REVIEW,
              KycStatus.NOT_SUBMITTED,
            ]),
          },
        }),
        this.merchantRepo.count({
          where: { status: MerchantStatus.SUSPENDED },
        }),
        this.merchantRepo.count({
          where: {
            createdAt: Between(start, end),
          },
        }),
      ]);

    return {
      total,
      active,
      pendingKyc,
      suspended,
      newThisPeriod,
    };
  }

  private async getSettlementStats(
    start: Date,
    end: Date,
  ): Promise<{
    completedCount: number;
    completedVolumeUsd: number;
    failedCount: number;
    pendingCount: number;
    pendingVolumeUsd: number;
  }> {
    const qb = this.settlementRepo
      .createQueryBuilder('s')
      .where('s.created_at BETWEEN :start AND :end', { start, end });

    const [completedCount, failedCount, pendingCount, completedSum, pendingSum] =
      await Promise.all([
        qb
          .clone()
          .andWhere('s.status = :status', {
            status: SettlementStatus.COMPLETED,
          })
          .getCount(),
        qb
          .clone()
          .andWhere('s.status = :status', { status: SettlementStatus.FAILED })
          .getCount(),
        qb
          .clone()
          .andWhere('s.status IN (:...statuses)', {
            statuses: [
              SettlementStatus.PENDING,
              SettlementStatus.PROCESSING,
            ],
          })
          .getCount(),
        this.settlementRepo
          .createQueryBuilder('s')
          .select('COALESCE(SUM(CAST(s.amount AS DECIMAL)), 0)', 'sum')
          .where('s.created_at BETWEEN :start AND :end', { start, end })
          .andWhere('s.status = :status', {
            status: SettlementStatus.COMPLETED,
          })
          .getRawOne<{ sum: string }>(),
        this.settlementRepo
          .createQueryBuilder('s')
          .select('COALESCE(SUM(CAST(s.amount AS DECIMAL)), 0)', 'sum')
          .where('s.created_at BETWEEN :start AND :end', { start, end })
          .andWhere('s.status IN (:...statuses)', {
            statuses: [
              SettlementStatus.PENDING,
              SettlementStatus.PROCESSING,
            ],
          })
          .getRawOne<{ sum: string }>(),
      ]);

    return {
      completedCount,
      completedVolumeUsd: parseFloat(completedSum?.sum || '0') || 0,
      failedCount,
      pendingCount,
      pendingVolumeUsd: parseFloat(pendingSum?.sum || '0') || 0,
    };
  }

  private async getFeesCollected(start: Date, end: Date): Promise<number> {
    const r = await this.settlementRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(CAST(s.fee_amount AS DECIMAL)), 0)', 'sum')
      .where('s.created_at BETWEEN :start AND :end', { start, end })
      .andWhere('s.status = :status', { status: SettlementStatus.COMPLETED })
      .getRawOne<{ sum: string }>();
    return parseFloat(r?.sum || '0') || 0;
  }

  private async getPendingSettlementCount(
    start: Date,
    end: Date,
  ): Promise<number> {
    const txList = await this.transactionRepo
      .createQueryBuilder('t')
      .select('DISTINCT t.payment_request_id', 'id')
      .where('t.created_at BETWEEN :start AND :end', { start, end })
      .andWhere('t.status = :status', { status: TransactionStatus.CONFIRMED })
      .getRawMany<{ id: string }>();

    const ids = txList.map((r) => r.id).filter(Boolean);
    if (ids.length === 0) return 0;

    return this.settlementRepo.count({
      where: {
        paymentRequestId: In(ids),
        status: In([
          SettlementStatus.PENDING,
          SettlementStatus.PROCESSING,
        ]),
      },
    });
  }

  private async buildAlerts(metrics: {
    failedTransactionRatePercent: number;
    pendingSettlementCount: number;
    failedSettlementCount: number;
  }): Promise<DashboardAlertDto[]> {
    const raw = await this.redis.get<AlertThresholds>(
      RedisKeys.dashboardAlertThresholds(),
    );
    const thresholds: AlertThresholds = raw || {};
    const alerts: DashboardAlertDto[] = [];
    const since = new Date().toISOString();

    const failedRateThreshold =
      thresholds.failedTransactionRatePercent ?? 2.0;
    if (metrics.failedTransactionRatePercent >= failedRateThreshold) {
      alerts.push({
        type: 'HIGH_FAILED_TRANSACTIONS',
        severity: 'WARNING',
        message: `Failed transaction rate is ${metrics.failedTransactionRatePercent.toFixed(1)}% (threshold: ${failedRateThreshold}%)`,
        since,
      });
    }

    if (
      thresholds.pendingSettlementCount != null &&
      metrics.pendingSettlementCount >= thresholds.pendingSettlementCount
    ) {
      alerts.push({
        type: 'HIGH_PENDING_SETTLEMENTS',
        severity: 'INFO',
        message: `Pending settlements count is ${metrics.pendingSettlementCount} (threshold: ${thresholds.pendingSettlementCount})`,
        since,
      });
    }

    if (
      thresholds.failedSettlementCount != null &&
      metrics.failedSettlementCount >= thresholds.failedSettlementCount
    ) {
      alerts.push({
        type: 'HIGH_FAILED_SETTLEMENTS',
        severity: 'WARNING',
        message: `Failed settlements count is ${metrics.failedSettlementCount} (threshold: ${thresholds.failedSettlementCount})`,
        since,
      });
    }

    return alerts;
  }
}
