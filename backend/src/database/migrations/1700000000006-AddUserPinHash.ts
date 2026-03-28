import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPinHash1700000000006 implements MigrationInterface {
  name = 'AddUserPinHash1700000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "pin_hash" character varying(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "pin_hash"
    `);
  }
}
