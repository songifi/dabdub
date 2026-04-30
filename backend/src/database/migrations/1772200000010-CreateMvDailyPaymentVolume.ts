import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMvDailyPaymentVolume1772200000010 implements MigrationInterface {
  name = 'CreateMvDailyPaymentVolume1772200000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const paymentsTableExists = await queryRunner.hasTable('payments');
    if (!paymentsTableExists) {
      return;
    }

    await queryRunner.query(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_payment_volume AS
      SELECT
        DATE_TRUNC('day', p."createdAt") AS day,
        p."merchantId",
        COUNT(*)::bigint                 AS payment_count,
        COALESCE(SUM(p."amountUsd"), 0)  AS volume_usd
      FROM payments p
      WHERE p.status = 'settled'
        AND p."deletedAt" IS NULL
      GROUP BY DATE_TRUNC('day', p."createdAt"), p."merchantId"
    `);

    // Unique index is required for REFRESH CONCURRENTLY
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uidx_mv_daily_payment_volume
        ON mv_daily_payment_volume (day, "merchantId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_daily_payment_volume`);
  }
}
