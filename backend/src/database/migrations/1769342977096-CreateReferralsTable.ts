import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReferralsTable1769342977096 implements MigrationInterface {
  name = 'CreateReferralsTable1769342977096';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "referralCode" varchar
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "IDX_users_referral_code"
      ON "users" ("referralCode")
      WHERE "referralCode" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TYPE "referrals_status_enum" AS ENUM (
        'pending',
        'converted',
        'rewarded',
        'expired'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "referrals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "referrerId" varchar NOT NULL,
        "referredUserId" varchar NOT NULL,
        "code" varchar NOT NULL,
        "status" "referrals_status_enum" NOT NULL DEFAULT 'pending',
        "rewardAmountUsdc" varchar NOT NULL DEFAULT '0.00',
        "convertedAt" timestamp,
        "rewardedAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_referrals" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_referrals_referred_user_id" UNIQUE ("referredUserId")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY "IDX_referrals_referrer_id"
      ON "referrals" ("referrerId")
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY "IDX_referrals_status"
      ON "referrals" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY "IDX_referrals_code"
      ON "referrals" ("code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_referrals_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_referrals_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_referrals_referrer_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "referrals"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "referrals_status_enum"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_referral_code"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "referralCode"
    `);
  }
}
