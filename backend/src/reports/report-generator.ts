import { DataSource } from 'typeorm';
import { ReportType, ReportParams } from './entities/report-job.entity';

const PAGE_SIZE = 500;

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsv(row: Record<string, unknown>): string {
  return Object.values(row).map(escapeCsv).join(',');
}

function headerFromRow(row: Record<string, unknown>): string {
  return Object.keys(row).join(',');
}

/**
 * Streams report data using cursor-based pagination and returns a CSV Buffer.
 * Never loads the full dataset into memory — processes PAGE_SIZE rows at a time.
 */
export async function generateCsv(
  dataSource: DataSource,
  type: ReportType,
  params: ReportParams,
): Promise<Buffer> {
  const chunks: string[] = [];
  let headerWritten = false;
  let lastId: string | null = null;

  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : new Date('2000-01-01');
  const dateTo = params.dateTo ? new Date(params.dateTo) : new Date();

  while (true) {
    const rows = await fetchPage(dataSource, type, dateFrom, dateTo, lastId, PAGE_SIZE);
    if (rows.length === 0) break;

    for (const row of rows) {
      if (!headerWritten) {
        chunks.push(headerFromRow(row) + '\n');
        headerWritten = true;
      }
      chunks.push(rowToCsv(row) + '\n');
    }

    lastId = rows[rows.length - 1]?.['id'] as string ?? null;
    if (rows.length < PAGE_SIZE) break;
  }

  if (!headerWritten) chunks.push('No data found for the selected range\n');

  return Buffer.from(chunks.join(''), 'utf8');
}

async function fetchPage(
  dataSource: DataSource,
  type: ReportType,
  dateFrom: Date,
  dateTo: Date,
  lastId: string | null,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const cursorClause = lastId ? `AND t.id > :lastId` : '';
  const params: Record<string, unknown> = { dateFrom, dateTo, limit, lastId: lastId ?? '' };

  switch (type) {
    case ReportType.USER_TRANSACTIONS:
      return dataSource.query(
        `SELECT t.id, t.user_id, t.type, t.amount_usdc, t.currency, t.fee,
                t.status, t.reference, t.description, t.created_at
         FROM transactions t
         WHERE t.created_at >= :dateFrom AND t.created_at <= :dateTo
         ${cursorClause}
         ORDER BY t.id ASC LIMIT :limit`,
        params,
      );

    case ReportType.MERCHANT_SETTLEMENTS:
      return dataSource.query(
        `SELECT m.id, m.user_id, m.business_name, m.settlement_currency,
                m.settlement_threshold_usdc, m.is_verified, m.created_at
         FROM merchants m
         WHERE m.created_at >= :dateFrom AND m.created_at <= :dateTo
         ${cursorClause}
         ORDER BY m.id ASC LIMIT :limit`,
        params,
      );

    case ReportType.FEE_SUMMARY:
      return dataSource.query(
        `SELECT t.id, t.type, t.fee, t.amount_usdc, t.status, t.created_at
         FROM transactions t
         WHERE t.fee IS NOT NULL
           AND t.created_at >= :dateFrom AND t.created_at <= :dateTo
         ${cursorClause}
         ORDER BY t.id ASC LIMIT :limit`,
        params,
      );

    case ReportType.KYC_SUBMISSIONS:
      return dataSource.query(
        `SELECT k.id, k.user_id, k.target_tier, k.status, k.document_type,
                k.reviewed_by, k.reviewed_at, k.created_at
         FROM kyc_submissions k
         WHERE k.created_at >= :dateFrom AND k.created_at <= :dateTo
         ${cursorClause}
         ORDER BY k.id ASC LIMIT :limit`,
        params,
      );

    case ReportType.WAITLIST_EXPORT:
      return dataSource.query(
        `SELECT w.id, w.email, w.name, w.referral_code, w.referred_by_code,
                w.points, w.is_fraud_flagged, w.joined_at
         FROM waitlist_entries w
         WHERE w.joined_at >= :dateFrom AND w.joined_at <= :dateTo
         ${cursorClause}
         ORDER BY w.id ASC LIMIT :limit`,
        params,
      );

    default:
      return [];
  }
}
