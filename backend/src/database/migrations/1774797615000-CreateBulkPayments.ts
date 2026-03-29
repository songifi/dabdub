import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBulkPayments1774797615000 implements MigrationInterface {
  name = 'CreateBulkPayments1774797615000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");

    // Create bulk_payments table
    await queryRunner.query(`
      CREATE TYPE "bulk_payments_status_enum" AS ENUM ('pending', 'processing', 'completed', 'partial_failure')
    `);

    await queryRunner.query(`
      CREATE TABLE "bulk_payments" (
        "id"                UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "initiated_by"      UUID         NOT NULL,
        "label"             VARCHAR(100) NOT NULL,
        "csv_key"           VARCHAR      NOT NULL,
        "total_rows"        INTEGER      NOT NULL,
        "success_count"     INTEGER      NOT NULL DEFAULT 0,
        "failure_count"     INTEGER      NOT NULL DEFAULT 0,
        "total_amount_usdc" VARCHAR      NOT NULL,
        "status"            "bulk_payments_status_enum" NOT NULL DEFAULT 'pending',
        "completed_at"      TIMESTAMPTZ           DEFAULT NULL,
        CONSTRAINT "PK_bulk_payments" PRIMARY KEY ("id")
      )
    `);

    // Create bulk_payment_rows table
    await queryRunner.query(`
      CREATE TYPE "bulk_payment_rows_status_enum" AS ENUM ('pending', 'success', 'failed')
    `);

    await queryRunner.query(`
      CREATE TABLE "bulk_payment_rows" (
        "id"                UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"        TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "bulk_payment_id"   UUID         NOT NULL,
        "row_number"        INTEGER      NOT NULL,
        "to_username"       VARCHAR      NOT NULL,
        "amount_usdc"       VARCHAR      NOT NULL,
        "note"              VARCHAR           DEFAULT NULL,
        "status"            "bulk_payment_rows_status_enum" NOT NULL DEFAULT 'pending',
        "failure_reason"    VARCHAR           DEFAULT NULL,
        "tx_id"             VARCHAR           DEFAULT NULL,
        "processed_at"      TIMESTAMPTZ       DEFAULT NULL,
        CONSTRAINT "PK_bulk_payment_rows" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "bulk_payment_rows"
      ADD CONSTRAINT "FK_bulk_payment_rows_bulk_payment_id"
      FOREIGN KEY ("bulk_payment_id") REFERENCES "bulk_payments"("id") ON DELETE CASCADE
    `);

    // Add indexes
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_bulk_payments_initiated_by" ON "bulk_payments" ("initiated_by")`);
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_bulk_payment_rows_bulk_payment_id" ON "bulk_payment_rows" ("bulk_payment_id")`);
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_bulk_payment_rows_status" ON "bulk_payment_rows" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bulk_payment_rows_status"`);
    await queryRunner.query(`DROP INDEX "IDX_bulk_payment_rows_bulk_payment_id"`);
    await queryRunner.query(`DROP INDEX "IDX_bulk_payments_initiated_by"`);

    await queryRunner.query(`ALTER TABLE "bulk_payment_rows" DROP CONSTRAINT "FK_bulk_payment_rows_bulk_payment_id"`);

    await queryRunner.query(`DROP TABLE "bulk_payment_rows"`);
    await queryRunner.query(`DROP TABLE "bulk_payments"`);

    await queryRunner.query(`DROP TYPE "bulk_payment_rows_status_enum"`);
    await queryRunner.query(`DROP TYPE "bulk_payments_status_enum"`);
  }
}