import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds columns required for merchant API key management (SHA-256 hashed keys,
 * scopes, prefix for masked display, ipWhitelist, rate_limit).
 * Existing user-scoped API keys (userId) are unchanged.
 */
export class AddMerchantApiKeyColumns1772600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "api_keys"
        ADD COLUMN IF NOT EXISTS "prefix" varchar,
        ADD COLUMN IF NOT EXISTS "scopes" jsonb DEFAULT '["payments:read"]',
        ADD COLUMN IF NOT EXISTS "ipWhitelist" jsonb DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "rateLimit" integer DEFAULT 1000
    `);
    // Allow uuid primary key for new merchant keys; existing table may have varchar id
    // If your api_keys.id is already varchar, you may need to keep it and use a different strategy.
    // This migration only adds optional columns.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "api_keys"
        DROP COLUMN IF EXISTS "prefix",
        DROP COLUMN IF EXISTS "scopes",
        DROP COLUMN IF EXISTS "ipWhitelist",
        DROP COLUMN IF EXISTS "rateLimit"
    `);
  }
}
