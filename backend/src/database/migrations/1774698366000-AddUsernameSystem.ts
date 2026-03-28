import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsernameSystem1774698366000 implements MigrationInterface {
  name = 'AddUsernameSystem1774698366000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create username_histories table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "username_histories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" character varying NOT NULL,
        "old_username" character varying(50) NOT NULL,
        "new_username" character varying(50) NOT NULL,
        "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_username_histories_id" PRIMARY KEY ("id")
      )
    `);

    // 2. Add index to user_id in username_histories
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_username_histories_user_id" ON "username_histories" ("user_id")
    `);

    // 3. Ensure users table has a strictly validated username field
    // We update the type and enforce the 20 char limit.
    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "username" TYPE character varying(20)
    `);

    // 4. Add unique index to username in users table if it doesn't exist
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_users_username";
      CREATE UNIQUE INDEX "IDX_users_username" ON "users" ("username");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_username"`);
    await queryRunner.query(`
      ALTER TABLE "users" 
      ALTER COLUMN "username" TYPE character varying(50)
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_username_histories_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "username_histories"`);
  }
}
