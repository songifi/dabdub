import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DisputesWalletHoldAndSupportDispute1770700000000
  implements MigrationInterface
{
  name = 'DisputesWalletHoldAndSupportDispute1770700000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET lock_timeout = '5s'`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_type_enum') THEN
          CREATE TYPE dispute_type_enum AS ENUM (
            'unauthorized', 'wrong_amount', 'duplicate', 'not_received', 'other'
          );
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status_enum') THEN
          CREATE TYPE dispute_status_enum AS ENUM (
            'open', 'investigating', 'resolved_approved', 'resolved_rejected'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "disputes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "transaction_id" uuid NOT NULL,
        "type" dispute_type_enum NOT NULL,
        "description" text NOT NULL,
        "status" dispute_status_enum NOT NULL DEFAULT 'open',
        "resolution" character varying,
        "resolved_by" uuid,
        "reversal_tx_hash" character varying,
        "resolved_at" TIMESTAMPTZ,
        CONSTRAINT "PK_disputes_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_disputes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_disputes_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disputes_user_id" ON "disputes" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disputes_transaction_id" ON "disputes" ("transaction_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_disputes_status" ON "disputes" ("status")
    `);

    await queryRunner.query(`
      ALTER TABLE "wallets"
      ADD COLUMN IF NOT EXISTS "disputed_hold" character varying NOT NULL DEFAULT '0'
    `);

    await queryRunner.query(`
      DO $e$
      BEGIN
        ALTER TYPE ticket_category ADD VALUE 'dispute';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $e$;
    `);

    await queryRunner.query(`
      ALTER TABLE support_ticket
      ADD COLUMN IF NOT EXISTS dispute_id uuid REFERENCES disputes(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_support_ticket_dispute ON support_ticket(dispute_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_support_ticket_dispute`);
    await queryRunner.query(
      `ALTER TABLE support_ticket DROP COLUMN IF EXISTS dispute_id`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP COLUMN IF EXISTS "disputed_hold"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "disputes"`);
    await queryRunner.query(`DROP TYPE IF EXISTS dispute_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS dispute_type_enum`);
    // Note: PostgreSQL cannot remove enum value 'dispute' from ticket_category easily; omitted.
  }
}
