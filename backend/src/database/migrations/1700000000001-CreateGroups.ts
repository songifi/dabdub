import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGroups1700000000001 implements MigrationInterface {
  name = 'CreateGroups1700000000001';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");
    await queryRunner.query(`
      CREATE TABLE "groups" (
        "id"                UUID NOT NULL DEFAULT uuid_generate_v4(),
        "name"              VARCHAR(100) NOT NULL,
        "description"       TEXT,
        "avatarUrl"         VARCHAR,
        "createdBy"         UUID NOT NULL,
        "maxMembers"        INTEGER NOT NULL DEFAULT 100,
        "isPublic"          BOOLEAN NOT NULL DEFAULT true,
        "inviteCode"        VARCHAR(16) UNIQUE,
        "isTokenGated"      BOOLEAN NOT NULL DEFAULT false,
        "gateTokenAddress"  VARCHAR,
        "gateMinBalance"    DECIMAL(36,7),
        "onChainId"         VARCHAR,
        "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deletedAt"         TIMESTAMPTZ,
        CONSTRAINT "PK_groups" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY "IDX_GROUP_NAME" ON "groups" ("name")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX CONCURRENTLY "IDX_GROUP_INVITE_CODE"
        ON "groups" ("inviteCode")
        WHERE "inviteCode" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TYPE "group_members_role_enum" AS ENUM ('owner', 'admin', 'member')
    `);

    await queryRunner.query(`
      CREATE TABLE "group_members" (
        "id"        UUID NOT NULL DEFAULT uuid_generate_v4(),
        "groupId"   UUID NOT NULL,
        "userId"    UUID NOT NULL,
        "role"      "group_members_role_enum" NOT NULL DEFAULT 'member',
        "joinedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_members" PRIMARY KEY ("id"),
        CONSTRAINT "FK_group_members_group"
          FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX CONCURRENTLY "IDX_GROUP_MEMBER_UNIQUE"
        ON "group_members" ("groupId", "userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "group_members"`);
    await queryRunner.query(`DROP TYPE "group_members_role_enum"`);
    await queryRunner.query(`DROP TABLE "groups"`);
  }
}
