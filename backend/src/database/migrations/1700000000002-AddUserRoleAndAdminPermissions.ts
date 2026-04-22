import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRoleAndAdminPermissions1700000000002
  implements MigrationInterface
{
  name = 'AddUserRoleAndAdminPermissions1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "users_role_enum" AS ENUM (
        'user',
        'merchant',
        'admin',
        'super_admin'
      )
    `);

    // Add role to users; backfill admin from legacy is_admin flag.
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "role" "users_role_enum" NOT NULL DEFAULT 'user'
    `);

    await queryRunner.query(`
      UPDATE "users"
      SET "role" = 'admin'
      WHERE "is_admin" = true
    `);

    await queryRunner.query(`
      CREATE TYPE IF NOT EXISTS "admin_permissions_permission_enum" AS ENUM (
        'kyc.review',
        'fee.manage',
        'user.freeze',
        'tier.manage',
        'config.manage',
        'report.export',
        'broadcast.send',
        'compliance.review'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_permissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "admin_id" uuid NOT NULL,
        "permission" "admin_permissions_permission_enum" NOT NULL,
        "granted_by" uuid NOT NULL,
        "granted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_permissions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_permissions_admin"
      ON "admin_permissions" ("admin_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_admin_permissions_admin_permission"
      ON "admin_permissions" ("admin_id", "permission")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_admin_permissions_admin_permission"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admin_permissions_admin"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_permissions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "admin_permissions_permission_enum"`);

    // Keep role column (down migrations are destructive; still remove type if possible).
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "users_role_enum"`);
  }
}

