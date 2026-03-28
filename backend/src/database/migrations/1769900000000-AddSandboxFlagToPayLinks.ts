import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSandboxFlagToPayLinks1769900000000
  implements MigrationInterface
{
  name = 'AddSandboxFlagToPayLinks1769900000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");
    await queryRunner.query(`
      ALTER TABLE "pay_links"
      ADD COLUMN IF NOT EXISTS "sandbox" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_pay_links_creator_sandbox_created"
      ON "pay_links" ("creator_user_id", "sandbox", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_pay_links_creator_sandbox_created"`,
    );

    await queryRunner.query(`
      ALTER TABLE "pay_links"
      DROP COLUMN IF EXISTS "sandbox"
    `);
  }
}
