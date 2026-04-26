import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppConfig1700000000005 implements MigrationInterface {
  name = 'CreateAppConfig1700000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_configs" (
        "id"          uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "key"         varchar(100)  NOT NULL,
        "value"       jsonb         NOT NULL,
        "description" varchar(255)  DEFAULT NULL,
        "updated_by"  uuid          DEFAULT NULL,
        "updated_at"  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_app_configs_id"  PRIMARY KEY ("id"),
        CONSTRAINT "UQ_app_configs_key" UNIQUE ("key")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "app_configs"`);
  }
}
