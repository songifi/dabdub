import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQueryPerformanceIndexes1772200000011
  implements MigrationInterface
{
  name = 'AddQueryPerformanceIndexes1772200000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payments_merchant_created_at"
      ON "payments" ("merchantId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payments_stellar_memo"
      ON "payments" ("stellarMemo")
      WHERE "stellarMemo" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payments_status"
      ON "payments" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_settlements_merchant_status"
      ON "settlements" ("merchantId", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_settlements_merchant_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_stellar_memo"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_payments_merchant_created_at"`);
  }
}
