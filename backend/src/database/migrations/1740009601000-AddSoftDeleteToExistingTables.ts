import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES = [
  'kyc_verifications',
  'kyc_documents',
  'kyc_audit_logs',
  'webhook_deliveries',
];

export class AddSoftDeleteToExistingTables1740009601000
  implements MigrationInterface
{
  name = 'AddSoftDeleteToExistingTables1740009601000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of TABLES) {
      await queryRunner.query(
        `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "deleted_at"`,
      );
    }
  }
}
