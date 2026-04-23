import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

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

@Injectable()
export class MerchantAnalyticsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getMetrics(asOf = new Date()): Promise<MerchantAnalyticsResponse> {
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
    };
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
}
