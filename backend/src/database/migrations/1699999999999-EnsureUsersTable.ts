import { MigrationInterface, QueryRunner } from 'typeorm';

/** Minimal users table required by blockchain_wallets FK (see 1700000000002 migration). */
export class EnsureUsersTable1699999999999 implements MigrationInterface {
  name = 'EnsureUsersTable1699999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
