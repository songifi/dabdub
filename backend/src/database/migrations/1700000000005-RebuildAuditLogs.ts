import { MigrationInterface, QueryRunner } from 'typeorm';

export class RebuildAuditLogs1700000000005 implements MigrationInterface {
  public transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");
    // Drop old table if it exists (old schema had adminId, action, detail columns)
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);

    await queryRunner.query(`
      CREATE TYPE "audit_logs_actor_type_enum" AS ENUM ('user', 'admin', 'system')
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"             UUID NOT NULL DEFAULT uuid_generate_v4(),
        "actor_id"       VARCHAR(255) NOT NULL,
        "actor_type"     "audit_logs_actor_type_enum" NOT NULL,
        "action"         VARCHAR(255) NOT NULL,
        "resource_type"  VARCHAR(100) NOT NULL,
        "resource_id"    VARCHAR(255) NOT NULL,
        "before"         JSONB DEFAULT NULL,
        "after"          JSONB DEFAULT NULL,
        "ip_address"     VARCHAR(45) DEFAULT NULL,
        "user_agent"     TEXT DEFAULT NULL,
        "correlation_id" VARCHAR(255) DEFAULT NULL,
        "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // Composite index: resourceType + resourceId + createdAt DESC
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY "IDX_audit_logs_resource" ON "audit_logs" ("resource_type", "resource_id", "created_at" DESC)
    `);

    // actorId + createdAt DESC
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY "IDX_audit_logs_actor" ON "audit_logs" ("actor_id", "created_at" DESC)
    `);

    // action + createdAt DESC
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY "IDX_audit_logs_action" ON "audit_logs" ("action", "created_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_action"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_actor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_resource"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "audit_logs_actor_type_enum"`);
  }
}
