import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWebPushSubscriptionToDeviceTokens1769700000000
  implements MigrationInterface
{
  name = 'AddWebPushSubscriptionToDeviceTokens1769700000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");
    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      ADD COLUMN IF NOT EXISTS "subscription" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      DROP COLUMN IF EXISTS "subscription"
    `);
  }
}
