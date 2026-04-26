import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CacheService } from '../cache/cache.service';

const DAILY_SIGNUP_WINDOW_DAYS = 30;
const ACTIVATION_WINDOW_DAYS = 7;

interface SignupRow {
  day: string;
  count: string;
}

interface CountRow {
  count: string;
}

export interface MerchantAnalyticsPoint {
  date: string;
  signups: number;
}

export interface MerchantAnalyticsResponse {
  generatedAt: string;
  dailySignups: MerchantAnalyticsPoint[];
  activationRate: {
    windowDays: number;
    activatedMerchants: number;
    totalMerchants: number;
    percentage: number;
  };
  monthlyActiveMerchants: {
    month: string;
    count: number;
  };
}

export interface TopMerchant {
  businessName: string;
  volume: number;
  paymentCount: number;
  settlementCount: number;
  country: string;
}

export interface TopMerchantsResponse {
  merchants: TopMerchant[];
  period: string;
  generatedAt: string;
}

export interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
  dropOffCount?: number;
  dropOffPercentage?: number;
}

export interface PaymentFunnelResponse {
  stages: FunnelStage[];
  totalCreated: number;
  period: {
    startDate: string;
    endDate: string;
  };
  network?: string;
  generatedAt: string;
}

@Injectable()
export class MerchantAnalyticsService {
  private readonly logger = new Logger(MerchantAnalyticsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cache: CacheService,
  ) {}

  private analyticsCacheKey(params: {
    merchantId: string;
    endpoint: string;
    dateRange: string;
  }): string {
    return `analytics:${params.merchantId}:${params.endpoint}:${params.dateRange}`;
  }

  async getMetrics(asOf = new Date()): Promise<MerchantAnalyticsResponse> {
    const cacheKey = this.analyticsCacheKey({
      merchantId: 'admin',
      endpoint: 'merchants',
      dateRange: asOf.toISOString().slice(0, 10),
    });

    const { value } = await this.cache.getOrSet(
      cacheKey,
      async () => {
        const [dailySignupsRows, activationRows, monthlyActiveRows] =
          await Promise.all([
            this.dataSource.query<SignupRow[]>(
              `
                SELECT
                  DATE_TRUNC('day', "createdAt")::date::text AS day,
                  COUNT(*)::text AS count
                FROM users
                WHERE "is_admin" = false
                  AND "is_treasury" = false
                  AND "createdAt" >= ($1::timestamptz - INTERVAL '${DAILY_SIGNUP_WINDOW_DAYS - 1} days')
                GROUP BY 1
                ORDER BY 1 ASC
              `,
              [asOf.toISOString()],
            ),
            this.dataSource.query<CountRow[]>(
              `
                SELECT
                  COUNT(*) FILTER (
                    WHERE EXISTS (
                      SELECT 1
                      FROM sessions
                      WHERE sessions.user_id = users.id
                        AND sessions."createdAt" <= users."createdAt" + INTERVAL '${ACTIVATION_WINDOW_DAYS} days'
                    )
                  )::text AS count,
                  COUNT(*)::text AS total
                FROM users
                WHERE "is_admin" = false
                  AND "is_treasury" = false
              `,
            ),
            this.dataSource.query<CountRow[]>(
              `
                SELECT COUNT(DISTINCT sessions.user_id)::text AS count
                FROM sessions
                INNER JOIN users ON users.id = sessions.user_id
                WHERE users."is_admin" = false
                  AND users."is_treasury" = false
                  AND DATE_TRUNC('month', sessions.last_seen_at) = DATE_TRUNC('month', $1::timestamptz)
              `,
              [asOf.toISOString()],
            ),
          ]);

        const activation = activationRows[0] as CountRow & { total: string };
        const activatedMerchants = Number(activation?.count ?? 0);
        const totalMerchants = Number(activation?.total ?? 0);

        return {
          generatedAt: asOf.toISOString(),
          dailySignups: this.buildDailySignupSeries(asOf, dailySignupsRows),
          activationRate: {
            windowDays: ACTIVATION_WINDOW_DAYS,
            activatedMerchants,
            totalMerchants,
            percentage:
              totalMerchants === 0
                ? 0
                : Number(((activatedMerchants / totalMerchants) * 100).toFixed(2)),
          },
          monthlyActiveMerchants: {
            month: asOf.toISOString().slice(0, 7),
            count: Number(monthlyActiveRows[0]?.count ?? 0),
          },
        } satisfies MerchantAnalyticsResponse;
      },
      { ttlSeconds: 10 * 60 },
    );

    return value;
  }

  private buildDailySignupSeries(
    asOf: Date,
    rows: SignupRow[],
  ): MerchantAnalyticsPoint[] {
    const counts = new Map(rows.map((row) => [row.day, Number(row.count)]));
    const series: MerchantAnalyticsPoint[] = [];

    for (let offset = DAILY_SIGNUP_WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
      const current = new Date(asOf);
      current.setUTCDate(current.getUTCDate() - offset);
      const date = current.toISOString().slice(0, 10);
      series.push({
        date,
        signups: counts.get(date) ?? 0,
      });
    }

    return series;
  }

  async getTopMerchants(limit: number = 10, period: string = '30d'): Promise<TopMerchantsResponse> {
    const cacheKey = this.analyticsCacheKey({
      merchantId: 'admin',
      endpoint: 'top-merchants',
      dateRange: `${limit}:${period}`,
    });

    const periodDays = this.getPeriodDays(period);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    const query = `
      SELECT 
        m."businessName",
        COALESCE(SUM(p."amountUsd"), 0)::decimal AS volume,
        COUNT(p.id)::int AS "paymentCount",
        COUNT(DISTINCT p."settlementId") FILTER (WHERE p."settlementId" IS NOT NULL)::int AS "settlementCount",
        m.country
      FROM merchants m
      LEFT JOIN payments p ON m.id = p."merchantId" 
        AND p."createdAt" >= $1
        AND p.status IN ('confirmed', 'settling', 'settled')
      WHERE m.status = 'active'
      GROUP BY m.id, m."businessName", m.country
      ORDER BY volume DESC, "paymentCount" DESC
      LIMIT $2
    `;

    try {
      const { value, cacheHit } = await this.cache.getOrSet(
        cacheKey,
        async () => {
          const merchants = await this.dataSource.query(query, [cutoffDate.toISOString(), limit]);

          const response: TopMerchantsResponse = {
            merchants: merchants.map((row: any) => ({
              businessName: row.businessName,
              volume: parseFloat(row.volume),
              paymentCount: row.paymentCount,
              settlementCount: row.settlementCount,
              country: row.country || 'Unknown',
            })),
            period,
            generatedAt: new Date().toISOString(),
          };

          this.logger.debug(`Generated top merchants for ${limit}-${period}: ${merchants.length} results`);
          return response;
        },
        { ttlSeconds: 10 * 60 },
      );

      this.logger.debug(`Returning ${cacheHit ? 'cached' : 'fresh'} top merchants for ${limit}-${period}`);
      return value;
    } catch (error) {
      this.logger.error(`Failed to get top merchants: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPaymentFunnel(
    startDate?: string,
    endDate?: string,
    network?: string,
  ): Promise<PaymentFunnelResponse> {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    const cacheKey = this.analyticsCacheKey({
      merchantId: 'admin',
      endpoint: 'payment-funnel',
      dateRange: `${start.toISOString()}-${end.toISOString()}:${network ?? 'all'}`,
    });

    const { value } = await this.cache.getOrSet(
      cacheKey,
      async () => {
        // Build the base query with optional network filter
        const networkFilter = network ? 'AND p.network = $3' : '';
        const queryParams = [start.toISOString(), end.toISOString()];
        if (network) {
          queryParams.push(network);
        }

        const query = `
          SELECT 
            COUNT(*) FILTER (WHERE p.status IN ('pending', 'confirmed', 'settling', 'settled', 'failed', 'expired')) AS created,
            COUNT(*) FILTER (WHERE p.status IN ('confirmed', 'settling', 'settled')) AS confirmed,
            COUNT(*) FILTER (WHERE p.status IN ('settling', 'settled')) AS settling,
            COUNT(*) FILTER (WHERE p.status = 'settled') AS settled,
            COUNT(*) FILTER (WHERE p.status = 'failed') AS failed,
            COUNT(*) FILTER (WHERE p.status = 'expired') AS expired
          FROM payments p
          WHERE p."createdAt" >= $1 
            AND p."createdAt" <= $2
            ${networkFilter}
        `;

        const result = await this.dataSource.query(query, queryParams);
        const data = result[0];

        const created = parseInt(data.created);
        const confirmed = parseInt(data.confirmed);
        const settling = parseInt(data.settling);
        const settled = parseInt(data.settled);
        const failed = parseInt(data.failed);
        const expired = parseInt(data.expired);

        // Calculate stages with percentages and drop-offs
        const stages: FunnelStage[] = [
          {
            stage: 'created',
            count: created,
            percentage: 100,
          },
          {
            stage: 'confirmed',
            count: confirmed,
            percentage: created > 0 ? Number(((confirmed / created) * 100).toFixed(2)) : 0,
            dropOffCount: created - confirmed,
            dropOffPercentage: created > 0 ? Number((((created - confirmed) / created) * 100).toFixed(2)) : 0,
          },
          {
            stage: 'settling',
            count: settling,
            percentage: created > 0 ? Number(((settling / created) * 100).toFixed(2)) : 0,
            dropOffCount: confirmed - settling,
            dropOffPercentage: confirmed > 0 ? Number((((confirmed - settling) / confirmed) * 100).toFixed(2)) : 0,
          },
          {
            stage: 'settled',
            count: settled,
            percentage: created > 0 ? Number(((settled / created) * 100).toFixed(2)) : 0,
            dropOffCount: settling - settled,
            dropOffPercentage: settling > 0 ? Number((((settling - settled) / settling) * 100).toFixed(2)) : 0,
          },
        ];

        return {
          stages,
          totalCreated: created,
          period: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          },
          network,
          generatedAt: new Date().toISOString(),
        } satisfies PaymentFunnelResponse;
      },
      { ttlSeconds: 10 * 60 },
    );

    return value;
  }

  private getPeriodDays(period: string): number {
    switch (period) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
      default:
        return 30;
    }
  }
}
