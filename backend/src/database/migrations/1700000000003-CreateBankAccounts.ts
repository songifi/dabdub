import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBankAccounts1700000000003 implements MigrationInterface {
  name = 'CreateBankAccounts1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bank_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "bank_code" character varying(20) NOT NULL,
        "bank_name" character varying(120) NOT NULL,
        "account_number" character varying(10) NOT NULL,
        "account_name" character varying(160) NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "is_verified" boolean NOT NULL DEFAULT true,
        CONSTRAINT "PK_bank_accounts_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bank_accounts_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_bank_accounts_user_verified"
      ON "bank_accounts" ("user_id", "is_verified")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_bank_accounts_user_bank_account"
      ON "bank_accounts" ("user_id", "bank_code", "account_number")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_bank_accounts_user_bank_account"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_bank_accounts_user_verified"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "bank_accounts"`);
  }
}
