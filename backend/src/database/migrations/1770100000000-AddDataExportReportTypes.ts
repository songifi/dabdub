import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDataExportReportTypes1770100000000 implements MigrationInterface {
  name = 'AddDataExportReportTypes1770100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'report_type_enum' AND e.enumlabel = 'gdpr_export'
        ) THEN
          ALTER TYPE "report_type_enum" ADD VALUE 'gdpr_export';
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'report_type_enum' AND e.enumlabel = 'account_statement'
        ) THEN
          ALTER TYPE "report_type_enum" ADD VALUE 'account_statement';
        END IF;
      END
      $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres enum value removal is non-trivial; intentionally no-op for safety.
  }
}
