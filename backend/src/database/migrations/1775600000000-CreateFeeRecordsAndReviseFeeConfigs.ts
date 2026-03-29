import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeeRecordsAndReviseFeeConfigs1775600000000 implements MigrationInterface {
  name = 'CreateFeeRecordsAndReviseFeeConfigs1775600000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'fee_configs_fee_type_enum'
        ) THEN
          CREATE TYPE "fee_configs_fee_type_enum" AS ENUM ('transfer', 'withdrawal', 'paylink', 'stake', 'deposit');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'fee_configs_rate_type_enum'
        ) THEN
          CREATE TYPE "fee_configs_rate_type_enum" AS ENUM ('percent', 'flat');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fee_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "fee_type" "fee_configs_fee_type_enum" NOT NULL,
        "rate_type" "fee_configs_rate_type_enum" NOT NULL DEFAULT 'percent',
        "fee_value" numeric(24,8) NOT NULL DEFAULT 0,
        "effective_from" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid,
        CONSTRAINT "PK_fee_configs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "fee_configs"
      ADD COLUMN IF NOT EXISTS "rate_type" "fee_configs_rate_type_enum" NOT NULL DEFAULT 'percent'
    `);
    await queryRunner.query(`
      ALTER TABLE "fee_configs"
      ADD COLUMN IF NOT EXISTS "fee_value" numeric(24,8) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "fee_configs"
      ADD COLUMN IF NOT EXISTS "effective_from" TIMESTAMPTZ NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE "fee_configs"
      ADD COLUMN IF NOT EXISTS "created_by" uuid
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'fee_configs' AND column_name = 'base_fee_rate'
        ) THEN
          UPDATE "fee_configs"
          SET "fee_value" = COALESCE(CAST("base_fee_rate" AS numeric), 0) * 100
          WHERE "fee_value" = 0;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "fee_records" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "tx_type" "fee_configs_fee_type_enum" NOT NULL,
        "tx_id" uuid NOT NULL,
        "gross_amount" numeric(24,8) NOT NULL,
        "fee_amount" numeric(24,8) NOT NULL,
        "net_amount" numeric(24,8) NOT NULL,
        "fee_config_id" uuid NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fee_records" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "transfers"
      ADD COLUMN IF NOT EXISTS "fee_config_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "withdrawals"
      ADD COLUMN IF NOT EXISTS "fee_config_id" uuid
    `);

    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_fee_configs_type_active_effective" ON "fee_configs" ("fee_type", "is_active", "effective_from" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_fee_records_tx_type_created" ON "fee_records" ("tx_type", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_fee_records_user_id_created" ON "fee_records" ("user_id", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_fee_records_user_id_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_fee_records_tx_type_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_fee_configs_type_active_effective"`,
    );

    await queryRunner.query(
      `ALTER TABLE "withdrawals" DROP COLUMN IF EXISTS "fee_config_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfers" DROP COLUMN IF EXISTS "fee_config_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "fee_records"`);
  }
}
