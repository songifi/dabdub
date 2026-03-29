import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRateAlerts1770100000001 implements MigrationInterface {
  name = 'CreateRateAlerts1770100000001';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_direction_enum') THEN
          CREATE TYPE alert_direction_enum AS ENUM ('above', 'below');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'alert_status_enum') THEN
          CREATE TYPE alert_status_enum AS ENUM ('active', 'triggered', 'cancelled');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rate_alerts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "target_rate" decimal(20,8) NOT NULL,
        "direction" alert_direction_enum NOT NULL,
        "currency" varchar(10) NOT NULL DEFAULT 'NGN',
        "status" alert_status_enum NOT NULL DEFAULT 'active',
        "triggered_at" timestamptz,
        "notified_via" jsonb NOT NULL DEFAULT '[]'::jsonb,
        CONSTRAINT "PK_rate_alerts_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_rate_alerts_user_status"
      ON "rate_alerts" ("user_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_rate_alerts_status"
      ON "rate_alerts" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rate_alerts_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_rate_alerts_user_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rate_alerts"`);
    await queryRunner.query(`DROP TYPE IF EXISTS alert_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS alert_direction_enum`);
  }
}
