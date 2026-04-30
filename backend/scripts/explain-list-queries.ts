import 'reflect-metadata';
import { createConnection } from 'typeorm';

const explainQueries = [
  {
    name: 'payments_paginated_by_merchant_created_at',
    sql: `
      EXPLAIN ANALYZE
      SELECT *
      FROM payments
      WHERE "merchantId" = $1
      ORDER BY "createdAt" DESC
      LIMIT 20 OFFSET 0
    `,
    params: ['00000000-0000-0000-0000-000000000000'],
  },
  {
    name: 'payments_monitor_lookup_by_memo',
    sql: `
      EXPLAIN ANALYZE
      SELECT *
      FROM payments
      WHERE status = 'pending'
        AND "stellarMemo" = $1
      LIMIT 1
    `,
    params: ['MEMO_TEST'],
  },
  {
    name: 'payments_pending_for_cron',
    sql: `
      EXPLAIN ANALYZE
      SELECT *
      FROM payments
      WHERE status = 'pending'
      LIMIT 200
    `,
    params: [],
  },
  {
    name: 'settlements_by_merchant_and_status',
    sql: `
      EXPLAIN ANALYZE
      SELECT *
      FROM settlements
      WHERE "merchantId" = $1
        AND status = $2
      ORDER BY "createdAt" DESC
      LIMIT 20
    `,
    params: ['00000000-0000-0000-0000-000000000000', 'pending'],
  },
];

async function main(): Promise<void> {
  const connection = await createConnection({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'cheesepay',
    entities: [],
  });

  try {
    for (const query of explainQueries) {
      // eslint-disable-next-line no-console
      console.log(`\n--- ${query.name} ---`);
      const rows = await connection.query(query.sql, query.params);
      for (const row of rows) {
        // eslint-disable-next-line no-console
        console.log(row['QUERY PLAN']);
      }
    }
  } finally {
    await connection.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
