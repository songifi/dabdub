import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1700000000000 implements MigrationInterface {
  name = 'CreateNotifications1700000000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");
    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "notifications_type_enum" AS ENUM (
        'transfer_received',
        'transfer_sent',
        'withdrawal_confirmed',
        'paylink_paid',
        'deposit_confirmed',
        'kyc_update',
        'tier_upgraded',
        'system'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" character varying NOT NULL,
        "type" "notifications_type_enum" NOT NULL,
        "title" character varying(100) NOT NULL,
        "body" character varying(300) NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "is_read" boolean NOT NULL DEFAULT false,
        "read_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_notifications_user_read_created"
      ON "notifications" ("user_id", "is_read", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_user_read_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notifications_type_enum"`);
  }
}
