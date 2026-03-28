import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTransfers1769800000000 implements MigrationInterface {
  name = 'CreateTransfers1769800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "transfers_status_enum" AS ENUM ('pending', 'confirmed', 'failed')
    `);

    await queryRunner.query(`
      CREATE TABLE "transfers" (
        "id"            UUID         NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "from_user_id"  UUID         NOT NULL,
        "to_user_id"    UUID         NOT NULL,
        "from_username" VARCHAR(50)  NOT NULL,
        "to_username"   VARCHAR(50)  NOT NULL,
        "amount"        VARCHAR      NOT NULL,
        "fee"           VARCHAR      NOT NULL DEFAULT '0',
        "net_amount"    VARCHAR      NOT NULL,
        "note"          VARCHAR(100)          DEFAULT NULL,
        "tx_hash"       VARCHAR               DEFAULT NULL,
        "status"        "transfers_status_enum" NOT NULL DEFAULT 'pending',
        CONSTRAINT "PK_transfers" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_transfers_from_user_id" ON "transfers" ("from_user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_transfers_to_user_id" ON "transfers" ("to_user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_transfers_to_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_transfers_from_user_id"`);
    await queryRunner.query(`DROP TABLE "transfers"`);
    await queryRunner.query(`DROP TYPE "transfers_status_enum"`);
  }
}
