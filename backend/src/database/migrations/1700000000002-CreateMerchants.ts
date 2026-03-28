import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMerchants1700000000002 implements MigrationInterface {
  name = 'CreateMerchants1700000000002';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");
    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "users_role_enum" AS ENUM ('user', 'merchant', 'admin')
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "is_merchant" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "role" "users_role_enum" NOT NULL DEFAULT 'user'
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "role" = 'admin'
      WHERE "is_admin" = true
    `);

    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "merchants_business_type_enum" AS ENUM (
        'retail',
        'food',
        'services',
        'transport',
        'other'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "merchants_settlement_currency_enum" AS ENUM ('NGN', 'USDC')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "merchants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "business_name" character varying(80) NOT NULL,
        "business_type" "merchants_business_type_enum" NOT NULL,
        "logo_key" character varying(255),
        "description" character varying(300),
        "is_verified" boolean NOT NULL DEFAULT false,
        "settlement_currency" "merchants_settlement_currency_enum" NOT NULL DEFAULT 'NGN',
        "auto_settle_enabled" boolean NOT NULL DEFAULT true,
        "settlement_threshold_usdc" numeric(18,6) NOT NULL DEFAULT 10,
        CONSTRAINT "PK_merchants_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_merchants_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_merchants_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_merchants_is_verified"
      ON "merchants" ("is_verified")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_merchants_is_verified"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "merchants"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "merchants_settlement_currency_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "merchants_business_type_enum"`,
    );

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "is_merchant"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
  }
}
