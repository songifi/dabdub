import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateYieldEntries1700000000005 implements MigrationInterface {
  name = 'CreateYieldEntries1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "yield_entries_source_enum" AS ENUM ('staking_reward', 'bonus', 'referral')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "yield_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "amount_usdc" numeric(24,8) NOT NULL DEFAULT '0',
        "source" "yield_entries_source_enum" NOT NULL DEFAULT 'staking_reward',
        "note" character varying(255),
        CONSTRAINT "PK_yield_entries_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_yield_entries_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_yield_entries_user_created"
      ON "yield_entries" ("user_id", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_yield_entries_source"
      ON "yield_entries" ("source")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_yield_entries_source"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_yield_entries_user_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "yield_entries"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "yield_entries_source_enum"`);
  }
}
