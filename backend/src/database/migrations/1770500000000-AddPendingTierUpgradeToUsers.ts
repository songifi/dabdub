import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingTierUpgradeToUsers1770500000000 implements MigrationInterface {
  name = 'AddPendingTierUpgradeToUsers1770500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "pending_tier_upgrade" character varying(10) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "pending_tier_upgrade"
    `);
  }
}
