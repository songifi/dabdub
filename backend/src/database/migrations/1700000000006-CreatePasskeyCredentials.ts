import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePasskeyCredentials1700000000006 implements MigrationInterface {
  name = 'CreatePasskeyCredentials1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum for device type
    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "passkey_device_type" AS ENUM ('singleDevice', 'multiDevice')
    `);

    // Create passkey_credentials table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "passkey_credentials" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "credential_id" character varying(512) NOT NULL,
        "public_key" bytea NOT NULL,
        "counter" bigint NOT NULL DEFAULT '0',
        "device_type" "passkey_device_type" NOT NULL,
        "backed_up" boolean NOT NULL DEFAULT false,
        "transports" text[],
        "nickname" character varying(255),
        CONSTRAINT "PK_passkey_credentials_id" PRIMARY KEY ("id")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_passkey_credentials_user_id"
      ON "passkey_credentials" ("user_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_passkey_credentials_credential_id"
      ON "passkey_credentials" ("credential_id")
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "passkey_credentials"
      ADD CONSTRAINT "FK_passkey_credentials_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key
    await queryRunner.query(`
      ALTER TABLE "passkey_credentials"
      DROP CONSTRAINT IF EXISTS "FK_passkey_credentials_user_id"
    `);

    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_passkey_credentials_credential_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_passkey_credentials_user_id"
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "passkey_credentials"
    `);

    // Drop enum
    await queryRunner.query(`
      DROP TYPE IF EXISTS "passkey_device_type"
    `);
  }
}
