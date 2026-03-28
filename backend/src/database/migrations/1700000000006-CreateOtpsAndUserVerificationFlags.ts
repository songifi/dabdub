import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOtpsAndUserVerificationFlags1700000000006 implements MigrationInterface {
  name = 'CreateOtpsAndUserVerificationFlags1700000000006';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "email_verified" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "phone_verified" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "otp_type_enum"
      AS ENUM ('email_verify', 'phone_verify', 'login', 'withdraw', 'kyc')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "otps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "code_hash" character varying(255) NOT NULL,
        "type" "otp_type_enum" NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_at" TIMESTAMPTZ,
        "ip_address" character varying(64) NOT NULL,
        CONSTRAINT "PK_otps_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_otps_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_otps_user_type_created"
      ON "otps" ("user_id", "type", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_otps_user_type_used_expires"
      ON "otps" ("user_id", "type", "used_at", "expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_otps_user_type_used_expires"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_otps_user_type_created"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "otps"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "otp_type_enum"`);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "phone_verified"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "email_verified"
    `);
  }
}
