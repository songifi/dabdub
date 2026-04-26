import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSlippageConfig1772200000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "slippage_config" (
        "key"              VARCHAR(32)  NOT NULL,
        "max_slippage_bps" INTEGER      NOT NULL DEFAULT 100,
        "updated_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_slippage_config" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "slippage_config" ("key", "max_slippage_bps")
      VALUES ('global', 100)
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "slippage_config"`);
  }
}
