import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBlockchainWallets1700000000002 implements MigrationInterface {
  name = 'CreateBlockchainWallets1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "blockchain_wallets" (
        "id"                   UUID NOT NULL DEFAULT uuid_generate_v4(),
        "userId"               UUID NOT NULL,
        "stellarAddress"       VARCHAR NOT NULL,
        "encryptedSecretKey"   TEXT NOT NULL,
        "iv"                   VARCHAR NOT NULL,
        "balanceUsdc"          VARCHAR NOT NULL DEFAULT '0',
        "stakedBalance"        VARCHAR NOT NULL DEFAULT '0',
        "lastSyncedAt"         TIMESTAMP,
        "createdAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blockchain_wallets" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_blockchain_wallets_userId" UNIQUE ("userId"),
        CONSTRAINT "UQ_blockchain_wallets_stellarAddress" UNIQUE ("stellarAddress"),
        CONSTRAINT "FK_blockchain_wallets_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "blockchain_wallets"`);
  }
}
