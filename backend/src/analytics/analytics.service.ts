import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { Settlement, SettlementStatus } from '../settlements/entities/settlement.entity';

type AnalyticsPeriod = 'daily' | 'monthly';
type RevenueScope = 'merchant' | 'admin';

interface RevenueOptions {
  merchantId?: string;
  scope: RevenueScope;
  period: AnalyticsPeriod;
  from?: string;
  to?: string;
}

interface RevenueRange {
  start: Date;
  endInclusive: Date;
  endExclusive: Date;
  labelStart: string;
  labelEnd: string;
}

interface RevenueBreakdownRow {
  bucket: string;
  total: string;
  count: string;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private cache = new Map<string, { data: any; expiry: number }>();

  constructor(
    @InjectRepository(Payment)
    private paymentsRepo: Repository<Payment>,
    @InjectRepository(Settlement)
    private settlementsRepo: Repository<Settlement>,
  ) {}

  private async getCachedData(key: string, fetchFn: () => Promise<any>, ttl = 60000) {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      this.logger.debug(`Cache hit for ${key}`);
      return { ...cached.data, cacheHit: true };
    }
    this.logger.debug(`Cache miss for ${key}`);
    const data = await fetchFn();
    this.cache.set(key, { data, expiry: Date.now() + ttl });
    return { ...data, cacheHit: false };
  }

  async getVolume(merchantId: string, period: AnalyticsPeriod) {
    const cacheKey = `volume:${merchantId}:${period}`;
    return this.getCachedData(cacheKey, async () => {
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

      return { results };
    });
  }

  async getFunnel(merchantId: string) {
    const cacheKey = `funnel:${merchantId}`;
    return this.getCachedData(cacheKey, async () => {
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
        counts[s.status] = parseInt(s.count);
        counts.total += parseInt(s.count);
      });

      const percentages = {
        conversionRate: counts.total > 0 ? (counts.settled / counts.total) * 100 : 0,
        abandonmentRate: counts.total > 0 ? ((counts.expired + counts.failed) / counts.total) * 100 : 0,
      };

      return { counts, percentages };
    });
  }

  async getComparison(merchantId: string, period: AnalyticsPeriod) {
    const cacheKey = `comparison:${merchantId}:${period}`;
    return this.getCachedData(cacheKey, async () => {
      const now = new Date();
      let currentStart: Date, currentEnd: Date, prevStart: Date, prevEnd: Date;

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

      const growth = prevVolume > 0 ? ((currentVolume - prevVolume) / prevVolume) * 100 : (currentVolume > 0 ? 100 : 0);

      return {
        currentPeriod: { start: currentStart, end: currentEnd, volume: currentVolume },
        previousPeriod: { start: prevStart, end: prevEnd, volume: prevVolume },
        growth,
      };
    });
  }

  async getRevenue(options: RevenueOptions) {
    const { merchantId, period, scope, from, to } = options;
    const { current, previous } = this.resolveRevenueRanges(period, from, to);
    const cacheKey = [
      'revenue',
      scope,
      merchantId ?? 'all',
      period,
      current.start.toISOString(),
      current.endExclusive.toISOString(),
    ].join(':');

    return this.getCachedData(cacheKey, async () => {
      const [currentRows, currentTotal, previousTotal] = await Promise.all([
        this.getRevenueBreakdown(merchantId, period, current.start, current.endExclusive),
        this.getRevenueTotal(merchantId, current.start, current.endExclusive),
        this.getRevenueTotal(merchantId, previous.start, previous.endExclusive),
      ]);

      const currentTotalValue = this.normalizeDecimal(currentTotal);
      const previousTotalValue = this.normalizeDecimal(previousTotal);
      const absoluteChange = this.subtractDecimalStrings(currentTotalValue, previousTotalValue);

      return {
        scope,
        period,
        currentPeriod: {
          start: current.labelStart,
          end: current.labelEnd,
          totalFeeRevenueUsd: currentTotalValue,
        },
        previousPeriod: {
          start: previous.labelStart,
          end: previous.labelEnd,
          totalFeeRevenueUsd: previousTotalValue,
        },
        comparison: {
          absoluteChangeUsd: absoluteChange,
          percentageChange: this.calculatePercentageChange(
            currentTotalValue,
            previousTotalValue,
          ),
        },
        breakdown: this.buildRevenueSeries(period, current, currentRows),
      };
    });
  }

  private async getVolumeForPeriod(
    merchantId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
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

  private async getRevenueBreakdown(
    merchantId: string | undefined,
    period: AnalyticsPeriod,
    start: Date,
    end: Date,
  ): Promise<RevenueBreakdownRow[]> {
    const bucketExpression = this.getRevenueBucketExpression(period);
    const labelFormat = period === 'daily' ? 'YYYY-MM-DD' : 'YYYY-MM';
    const query = this.settlementsRepo
      .createQueryBuilder('settlement')
      .select(`TO_CHAR(${bucketExpression}, '${labelFormat}')`, 'bucket')
      .addSelect('COALESCE(SUM("settlement"."feeAmountUsd"), 0)::numeric(18,6)::text', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('"settlement"."status" = :status', { status: SettlementStatus.COMPLETED })
      .andWhere(`${bucketExpression} >= :start`, { start })
      .andWhere(`${bucketExpression} < :end`, { end });

    if (merchantId) {
      query.andWhere('"settlement"."merchantId" = :merchantId', { merchantId });
    }

    return query
      .groupBy(bucketExpression)
      .orderBy(bucketExpression, 'ASC')
      .getRawMany();
  }

  private async getRevenueTotal(
    merchantId: string | undefined,
    start: Date,
    end: Date,
  ): Promise<string> {
    const timestampExpression =
      'COALESCE("settlement"."completedAt", "settlement"."createdAt")';
    const query = this.settlementsRepo
      .createQueryBuilder('settlement')
      .select('COALESCE(SUM("settlement"."feeAmountUsd"), 0)::numeric(18,6)::text', 'total')
      .where('"settlement"."status" = :status', { status: SettlementStatus.COMPLETED })
      .andWhere(`${timestampExpression} >= :start`, { start })
      .andWhere(`${timestampExpression} < :end`, { end });

    if (merchantId) {
      query.andWhere('"settlement"."merchantId" = :merchantId', { merchantId });
    }

    const result = await query.getRawOne<{ total: string }>();
    return result?.total ?? '0.000000';
  }

  private getRevenueBucketExpression(period: AnalyticsPeriod): string {
    const timestampExpression =
      'COALESCE("settlement"."completedAt", "settlement"."createdAt")';
    return period === 'daily'
      ? `DATE_TRUNC('day', ${timestampExpression})`
      : `DATE_TRUNC('month', ${timestampExpression})`;
  }

  private resolveRevenueRanges(
    period: AnalyticsPeriod,
    from?: string,
    to?: string,
  ): { current: RevenueRange; previous: RevenueRange } {
    if (period === 'daily') {
      const defaultEnd = this.startOfUtcDay(new Date());
      const currentEnd = to ? this.parseIsoDate(to) : defaultEnd;
      const currentStart = from
        ? this.parseIsoDate(from)
        : this.addUtcDays(currentEnd, -29);

      if (currentStart > currentEnd) {
        throw new BadRequestException('"from" must be before or equal to "to"');
      }

      const spanDays = this.diffUtcDays(currentStart, currentEnd) + 1;
      const previousEndInclusive = this.addUtcDays(currentStart, -1);
      const previousStart = this.addUtcDays(currentStart, -spanDays);

      return {
        current: {
          start: currentStart,
          endInclusive: currentEnd,
          endExclusive: this.addUtcDays(currentEnd, 1),
          labelStart: this.formatDay(currentStart),
          labelEnd: this.formatDay(currentEnd),
        },
        previous: {
          start: previousStart,
          endInclusive: previousEndInclusive,
          endExclusive: currentStart,
          labelStart: this.formatDay(previousStart),
          labelEnd: this.formatDay(previousEndInclusive),
        },
      };
    }

    const defaultEnd = this.startOfUtcMonth(new Date());
    const currentEnd = to
      ? this.startOfUtcMonth(this.parseIsoDate(to))
      : defaultEnd;
    const currentStart = from
      ? this.startOfUtcMonth(this.parseIsoDate(from))
      : this.addUtcMonths(currentEnd, -11);

    if (currentStart > currentEnd) {
      throw new BadRequestException('"from" must be before or equal to "to"');
    }

    const spanMonths = this.diffUtcMonths(currentStart, currentEnd) + 1;
    const previousEndInclusive = this.addUtcDays(currentStart, -1);
    const previousStart = this.addUtcMonths(currentStart, -spanMonths);

    return {
      current: {
        start: currentStart,
        endInclusive: this.addUtcDays(this.addUtcMonths(currentEnd, 1), -1),
        endExclusive: this.addUtcMonths(currentEnd, 1),
        labelStart: this.formatMonth(currentStart),
        labelEnd: this.formatMonth(currentEnd),
      },
      previous: {
        start: previousStart,
        endInclusive: previousEndInclusive,
        endExclusive: currentStart,
        labelStart: this.formatMonth(previousStart),
        labelEnd: this.formatMonth(this.startOfUtcMonth(previousEndInclusive)),
      },
    };
  }

  private buildRevenueSeries(
    period: AnalyticsPeriod,
    range: RevenueRange,
    rows: RevenueBreakdownRow[],
  ) {
    const values = new Map(
      rows.map((row) => [
        row.bucket,
        {
          feeRevenueUsd: this.normalizeDecimal(row.total),
          settlementCount: parseInt(row.count, 10),
        },
      ]),
    );
    const series: Array<{
      date: string;
      feeRevenueUsd: string;
      settlementCount: number;
    }> = [];

    if (period === 'daily') {
      for (
        let cursor = new Date(range.start);
        cursor < range.endExclusive;
        cursor = this.addUtcDays(cursor, 1)
      ) {
        const label = this.formatDay(cursor);
        const point = values.get(label);
        series.push({
          date: label,
          feeRevenueUsd: point?.feeRevenueUsd ?? '0.000000',
          settlementCount: point?.settlementCount ?? 0,
        });
      }
      return series;
    }

    for (
      let cursor = new Date(range.start);
      cursor < range.endExclusive;
      cursor = this.addUtcMonths(cursor, 1)
    ) {
      const label = this.formatMonth(cursor);
      const point = values.get(label);
      series.push({
        date: label,
        feeRevenueUsd: point?.feeRevenueUsd ?? '0.000000',
        settlementCount: point?.settlementCount ?? 0,
      });
    }

    return series;
  }

  private calculatePercentageChange(current: string, previous: string): number {
    const currentNumber = Number(current);
    const previousNumber = Number(previous);

    if (previousNumber === 0) {
      return currentNumber > 0 ? 100 : 0;
    }

    return Number((((currentNumber - previousNumber) / previousNumber) * 100).toFixed(2));
  }

  private normalizeDecimal(value: string | number | null | undefined): string {
    const sign = typeof value === 'string' && value.trim().startsWith('-') ? '-' : '';
    const raw = String(value ?? '0').trim().replace(/^[+-]/, '');
    const [whole = '0', fractional = ''] = raw.split('.');
    return `${sign}${whole || '0'}.${(fractional + '000000').slice(0, 6)}`;
  }

  private subtractDecimalStrings(left: string, right: string): string {
    const leftUnits = this.decimalToUnits(left);
    const rightUnits = this.decimalToUnits(right);
    return this.unitsToDecimal(leftUnits - rightUnits);
  }

  private decimalToUnits(value: string): bigint {
    const normalized = this.normalizeDecimal(value);
    const sign = normalized.startsWith('-') ? -1n : 1n;
    const [whole, fractional] = normalized.replace('-', '').split('.');
    return sign * (BigInt(whole) * 1_000_000n + BigInt(fractional));
  }

  private unitsToDecimal(value: bigint): string {
    const sign = value < 0 ? '-' : '';
    const absolute = value < 0 ? -value : value;
    const whole = absolute / 1_000_000n;
    const fractional = (absolute % 1_000_000n).toString().padStart(6, '0');
    return `${sign}${whole.toString()}.${fractional}`;
  }

  private parseIsoDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Dates must use YYYY-MM-DD format');
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date: ${value}`);
    }

    return parsed;
  }

  private startOfUtcDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private startOfUtcMonth(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  }

  private addUtcDays(value: Date, days: number): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + days),
    );
  }

  private addUtcMonths(value: Date, months: number): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
  }

  private diffUtcDays(start: Date, end: Date): number {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.round((end.getTime() - start.getTime()) / millisecondsPerDay);
  }

  private diffUtcMonths(start: Date, end: Date): number {
    return (
      (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (end.getUTCMonth() - start.getUTCMonth())
    );
  }

  private formatDay(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private formatMonth(value: Date): string {
    return value.toISOString().slice(0, 7);
  }

  clearCache() {
    this.cache.clear();
  }
}
