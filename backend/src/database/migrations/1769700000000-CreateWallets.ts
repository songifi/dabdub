import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWallets1769700000000 implements MigrationInterface {
  name = 'CreateWallets1769700000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");
    await queryRunner.query(`
      CREATE TABLE "wallets" (
        "id"                   UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"           TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "user_id"              UUID         NOT NULL,
        "stellar_address"      VARCHAR(56)  NOT NULL,
        "encrypted_secret_key" TEXT         NOT NULL,
        "iv"                   TEXT         NOT NULL,
        "balance"              VARCHAR      NOT NULL DEFAULT '0',
        "staked_balance"       VARCHAR      NOT NULL DEFAULT '0',
        "last_synced_at"       TIMESTAMPTZ           DEFAULT NULL,
        CONSTRAINT "PK_wallets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_wallets_user_id" UNIQUE ("user_id"),
        CONSTRAINT "UQ_wallets_stellar_address" UNIQUE ("stellar_address")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY "IDX_wallets_user_id" ON "wallets" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_wallets_user_id"`);
    await queryRunner.query(`DROP TABLE "wallets"`);
  }
}
