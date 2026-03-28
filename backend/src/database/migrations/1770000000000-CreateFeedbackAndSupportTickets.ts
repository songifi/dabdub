import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeedbackAndSupportTickets1770000000000
  implements MigrationInterface
{
  name = 'CreateFeedbackAndSupportTickets1770000000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feedback_type_enum') THEN
          CREATE TYPE feedback_type_enum AS ENUM (
            'transaction_rating',
            'feature_feedback',
            'nps'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feedback" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "type" feedback_type_enum NOT NULL,
        "rating" integer,
        "nps_score" integer,
        "message" text,
        "context" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "app_version" varchar(64),
        "platform" varchar(32),
        "requires_outreach" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_feedback_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "support_tickets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "feedback_id" uuid NOT NULL,
        "title" varchar(150) NOT NULL,
        "description" text NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'open',
        CONSTRAINT "PK_support_tickets_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_feedback_user_created"
      ON "feedback" ("user_id", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_feedback_type_created"
      ON "feedback" ("type", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_feedback_outreach_created"
      ON "feedback" ("requires_outreach", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_support_tickets_feedback"
      ON "support_tickets" ("feedback_id")
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_support_tickets_user_created"
      ON "support_tickets" ("user_id", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_support_tickets_user_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_support_tickets_feedback"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_feedback_outreach_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_feedback_type_created"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_feedback_user_created"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "support_tickets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feedback"`);
    await queryRunner.query(`DROP TYPE IF EXISTS feedback_type_enum`);
  }
}
