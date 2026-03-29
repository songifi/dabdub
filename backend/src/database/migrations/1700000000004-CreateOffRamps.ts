import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOffRamps1700000000004 implements MigrationInterface {
  name = 'CreateOffRamps1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "off_ramps_status_enum" AS ENUM (
        'pending', 'usdc_deducted', 'transfer_initiated', 'completed', 'failed', 'refunded'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "off_ramps_provider_enum" AS ENUM ('paystack', 'flutterwave')
    `);

    await queryRunner.query(`
      CREATE TABLE "off_ramps" (
        "id"                   UUID NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"              UUID NOT NULL,
        "amount_usdc"          NUMERIC(24,8) NOT NULL,
        "fee_usdc"             NUMERIC(24,8) NOT NULL,
        "net_amount_usdc"      NUMERIC(24,8) NOT NULL,
        "rate"                 NUMERIC(18,6) NOT NULL,
        "spread_percent"       NUMERIC(5,2) NOT NULL,
        "ngn_amount"           NUMERIC(24,2) NOT NULL,
        "bank_account_id"      UUID NOT NULL,
        "bank_account_number"  VARCHAR(20) NOT NULL,
        "bank_name"            VARCHAR(120) NOT NULL,
        "account_name"         VARCHAR(160) NOT NULL,
        "reference"            VARCHAR(100) NOT NULL,
        "provider_reference"   VARCHAR(100),
        "provider"             "off_ramps_provider_enum" NOT NULL DEFAULT 'paystack',
        "status"               "off_ramps_status_enum" NOT NULL DEFAULT 'pending',
        "failure_reason"       TEXT,
        "transaction_id"       UUID,
        "metadata"             JSONB NOT NULL DEFAULT '{}',
        "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_off_ramps" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_off_ramps_reference" UNIQUE ("reference")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_off_ramps_user_id_created_at" ON "off_ramps" ("user_id", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_off_ramps_user_id" ON "off_ramps" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "off_ramps"`);
    await queryRunner.query(`DROP TYPE "off_ramps_status_enum"`);
    await queryRunner.query(`DROP TYPE "off_ramps_provider_enum"`);
  }
}
