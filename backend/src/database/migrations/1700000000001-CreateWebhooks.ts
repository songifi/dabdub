import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhooks1700000000001 implements MigrationInterface {
  name = 'CreateWebhooks1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "user_id" character varying NOT NULL,
        "url" text NOT NULL,
        "events" text[] NOT NULL,
        "secret" character varying(64) NOT NULL,
        "secret_enc" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_webhook_subscriptions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_subscriptions_user_active"
      ON "webhook_subscriptions" ("user_id", "is_active")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "subscription_id" uuid NOT NULL,
        "event" text NOT NULL,
        "payload" jsonb NOT NULL,
        "response_status" integer,
        "response_body" character varying,
        "attempt_count" integer NOT NULL DEFAULT 0,
        "delivered_at" TIMESTAMPTZ,
        "next_retry_at" TIMESTAMPTZ NOT NULL,
        CONSTRAINT "PK_webhook_deliveries_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_webhook_deliveries_subscription"
          FOREIGN KEY ("subscription_id") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_deliveries_subscription_created"
      ON "webhook_deliveries" ("subscription_id", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_webhook_deliveries_next_retry_at"
      ON "webhook_deliveries" ("next_retry_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_webhook_deliveries_next_retry_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_webhook_deliveries_subscription_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_deliveries"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_webhook_subscriptions_user_active"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_subscriptions"`);
  }
}
