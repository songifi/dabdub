import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateComplianceAuditLogsTable1769500000000
  implements MigrationInterface
{
  name = 'CreateComplianceAuditLogsTable1769500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "compliance_audit_action_enum" AS ENUM(
        'create', 'update', 'delete', 'view', 'export'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "compliance_actor_type_enum" AS ENUM(
        'user', 'admin', 'system', 'api_key', 'service_account'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "compliance_data_classification_enum" AS ENUM(
        'sensitive', 'normal', 'public'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "compliance_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "entity_type" varchar(100) NOT NULL,
        "entity_id" uuid NOT NULL,
        "action" "compliance_audit_action_enum" NOT NULL,
        "actor_id" uuid NOT NULL,
        "actor_type" "compliance_actor_type_enum" NOT NULL,
        "before_state" jsonb,
        "after_state" jsonb,
        "ip_address" inet,
        "user_agent" text,
        "request_id" varchar(100),
        "metadata" jsonb,
        "data_classification" "compliance_data_classification_enum" NOT NULL DEFAULT 'normal',
        "retention_until" timestamptz,
        "archived_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_compliance_audit_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_compliance_audit_logs_entity_type_entity_id" ON "compliance_audit_logs" ("entity_type", "entity_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_compliance_audit_logs_actor_id" ON "compliance_audit_logs" ("actor_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_compliance_audit_logs_created_at" ON "compliance_audit_logs" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_compliance_audit_logs_request_id" ON "compliance_audit_logs" ("request_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_compliance_audit_logs_entity_type_created_at" ON "compliance_audit_logs" ("entity_type", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_compliance_audit_logs_entity_type_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_compliance_audit_logs_request_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_compliance_audit_logs_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_compliance_audit_logs_actor_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "IDX_compliance_audit_logs_entity_type_entity_id"`,
    );

    await queryRunner.query(`DROP TABLE "compliance_audit_logs"`);

    await queryRunner.query(
      `DROP TYPE "compliance_data_classification_enum"`,
    );
    await queryRunner.query(`DROP TYPE "compliance_actor_type_enum"`);
    await queryRunner.query(`DROP TYPE "compliance_audit_action_enum"`);
  }
}
