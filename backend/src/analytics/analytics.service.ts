import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { AnalyticsCacheService } from '../cache/analytics-cache.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async getVolume(merchantId: string, period: 'daily' | 'monthly') {
    const cached = await this.analyticsCache.getParsed<{ results: unknown[] }>(
      merchantId,
      'volume',
      period,
      'merchant',
    );
    if (cached) {
      this.logger.debug(`Cache hit analytics:${merchantId}:volume:${period}`);
      return { ...cached, cacheHit: true };
    }

    const dateFormat = period === 'daily' ? 'YYYY-MM-DD' : 'YYYY-MM';

    const results = await this.paymentsRepo
      .createQueryBuilder('payment')
      .select(`TO_CHAR(payment.createdAt, '${dateFormat}')`, 'date')
      .addSelect('SUM(payment.amountUsd)', 'volume')
      .addSelect('COUNT(*)', 'count')
      .where('payment.merchantId = :merchantId', { merchantId })
      .andWhere('payment.status = :status', { status: PaymentStatus.SETTLED })
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    const payload = { results };
    await this.analyticsCache.setParsed(merchantId, 'volume', period, 'merchant', payload);
    return { ...payload, cacheHit: false };
  }

  async getFunnel(merchantId: string) {
    const cached = await this.analyticsCache.getParsed<{
      counts: Record<string, number>;
      percentages: { conversionRate: number; abandonmentRate: number };
    }>(merchantId, 'funnel', 'all', 'merchant');
    if (cached) {
      this.logger.debug(`Cache hit analytics:${merchantId}:funnel:all`);
      return { ...cached, cacheHit: true };
    }

    const stats = await this.paymentsRepo
      .createQueryBuilder('payment')
      .select('payment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('payment.merchantId = :merchantId', { merchantId })
      .groupBy('payment.status')
      .getRawMany();

    const counts = {
      total: 0,
      pending: 0,
      confirmed: 0,
      settling: 0,
      settled: 0,
      failed: 0,
      expired: 0,
    };

    stats.forEach((s) => {
      counts[s.status] = parseInt(s.count, 10);
      counts.total += parseInt(s.count, 10);
    });

    const percentages = {
      conversionRate: counts.total > 0 ? (counts.settled / counts.total) * 100 : 0,
      abandonmentRate: counts.total > 0 ? ((counts.expired + counts.failed) / counts.total) * 100 : 0,
    };

    const payload = { counts, percentages };
    await this.analyticsCache.setParsed(merchantId, 'funnel', 'all', 'merchant', payload);
    return { ...payload, cacheHit: false };
  }

  async getComparison(merchantId: string, period: 'daily' | 'monthly') {
    type ComparisonCached = {
      currentPeriod: { start: string; end: string; volume: number };
      previousPeriod: { start: string; end: string; volume: number };
      growth: number;
    };
    const cached = await this.analyticsCache.getParsed<ComparisonCached>(
      merchantId,
      'comparison',
      period,
      'merchant',
    );
    if (cached) {
      this.logger.debug(`Cache hit analytics:${merchantId}:comparison:${period}`);
      return this.revivifyComparison(cached, true);
    }

    const now = new Date();
    let currentStart: Date;
    let currentEnd: Date;
    let prevStart: Date;
    let prevEnd: Date;

    if (period === 'daily') {
      currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      prevStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      prevEnd = currentStart;
    } else {
      currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd = currentStart;
    }

    const [currentVolume, prevVolume] = await Promise.all([
      this.getVolumeForPeriod(merchantId, currentStart, currentEnd),
      this.getVolumeForPeriod(merchantId, prevStart, prevEnd),
    ]);

    const growth =
      prevVolume > 0 ? ((currentVolume - prevVolume) / prevVolume) * 100 : currentVolume > 0 ? 100 : 0;

    const payload = {
      currentPeriod: {
        start: currentStart.toISOString(),
        end: currentEnd.toISOString(),
        volume: currentVolume,
      },
      previousPeriod: {
        start: prevStart.toISOString(),
        end: prevEnd.toISOString(),
        volume: prevVolume,
      },
      growth,
    };
    await this.analyticsCache.setParsed(merchantId, 'comparison', period, 'merchant', payload);
    return this.revivifyComparison(payload, false);
  }

  private revivifyComparison(
    payload: {
      currentPeriod: { start: string; end: string; volume: number };
      previousPeriod: { start: string; end: string; volume: number };
      growth: number;
    },
    cacheHit: boolean,
  ) {
    return {
      currentPeriod: {
        start: new Date(payload.currentPeriod.start),
        end: new Date(payload.currentPeriod.end),
        volume: payload.currentPeriod.volume,
      },
      previousPeriod: {
        start: new Date(payload.previousPeriod.start),
        end: new Date(payload.previousPeriod.end),
        volume: payload.previousPeriod.volume,
      },
      growth: payload.growth,
      cacheHit,
    };
  }

  private async getVolumeForPeriod(merchantId: string, start: Date, end: Date): Promise<number> {
    const result = await this.paymentsRepo
      .createQueryBuilder('payment')
      .select('SUM(payment.amountUsd)', 'total')
      .where('payment.merchantId = :merchantId', { merchantId })
      .andWhere('payment.status = :status', { status: PaymentStatus.SETTLED })
      .andWhere('payment.createdAt >= :start', { start })
      .andWhere('payment.createdAt < :end', { end })
      .getRawOne();

    return parseFloat(result?.total || 0);
  }

  clearCache(): void {
    this.analyticsCache.clearAllForTesting();
  }
}
