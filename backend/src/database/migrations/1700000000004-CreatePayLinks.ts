import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayLinks1700000000004 implements MigrationInterface {
  name = 'CreatePayLinks1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "pay_links_status_enum" AS ENUM ('active', 'paid', 'cancelled', 'expired')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pay_links" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "creator_user_id" uuid NOT NULL,
        "token_id" character varying(64) NOT NULL,
        "amount" character varying(64) NOT NULL,
        "note" character varying(200),
        "status" "pay_links_status_enum" NOT NULL DEFAULT 'active',
        "paid_by_user_id" uuid,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "created_tx_hash" character varying(160) NOT NULL,
        "payment_tx_hash" character varying(160),
        CONSTRAINT "PK_pay_links_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_pay_links_token_id" UNIQUE ("token_id"),
        CONSTRAINT "FK_pay_links_creator_user_id" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pay_links_paid_by_user_id" FOREIGN KEY ("paid_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pay_links_creator_status_created"
      ON "pay_links" ("creator_user_id", "status", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pay_links_status_expires"
      ON "pay_links" ("status", "expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pay_links_status_expires"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pay_links_creator_status_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pay_links"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pay_links_status_enum"`);
  }
}
