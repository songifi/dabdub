import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeatureFlags1770600000000 implements MigrationInterface {
  name = 'CreateFeatureFlags1770600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feature_flag_status_enum') THEN
          CREATE TYPE feature_flag_status_enum AS ENUM (
            'disabled',
            'enabled',
            'percentage',
            'tier',
            'users'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feature_flags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "key" varchar(100) NOT NULL,
        "description" text NOT NULL,
        "status" feature_flag_status_enum NOT NULL,
        "percentage" int,
        "enabled_tiers" text[],
        "enabled_user_ids" text[],
        "created_by" uuid,
        CONSTRAINT "UQ_feature_flags_key" UNIQUE ("key"),
        CONSTRAINT "PK_feature_flags_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_feature_flags_status"
      ON "feature_flags" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_feature_flags_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feature_flags"`);
    await queryRunner.query(`DROP TYPE IF EXISTS feature_flag_status_enum`);
  }
}
