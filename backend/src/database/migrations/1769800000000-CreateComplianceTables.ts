import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateComplianceTables1769800000000
  implements MigrationInterface
{
  name = 'CreateComplianceTables1769800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "compliance_event_type_enum" AS ENUM (
        'aml_threshold', 'velocity', 'structuring', 'other'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "compliance_event_severity_enum" AS ENUM (
        'medium', 'high', 'critical'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "compliance_event_status_enum" AS ENUM (
        'open', 'reviewing', 'resolved'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "sar_report_type_enum" AS ENUM (
        'aml_threshold', 'velocity', 'structuring', 'other'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "sar_status_enum" AS ENUM (
        'draft', 'submitted', 'filed'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "compliance_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" "compliance_event_type_enum" NOT NULL,
        "severity" "compliance_event_severity_enum" NOT NULL,
        "status" "compliance_event_status_enum" NOT NULL DEFAULT 'open',
        "description" text NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "resolved_by" uuid DEFAULT NULL,
        "resolved_at" TIMESTAMPTZ DEFAULT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_compliance_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "suspicious_activity_reports" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "generated_by" uuid NOT NULL,
        "report_type" "sar_report_type_enum" NOT NULL,
        "narrative" text NOT NULL,
        "status" "sar_status_enum" NOT NULL DEFAULT 'draft',
        "filed_at" TIMESTAMPTZ DEFAULT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_suspicious_activity_reports_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_compliance_events_user_id" ON "compliance_events" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_compliance_events_status" ON "compliance_events" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_compliance_events_type" ON "compliance_events" ("type")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sar_user_id" ON "suspicious_activity_reports" ("user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sar_generated_by" ON "suspicious_activity_reports" ("generated_by")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sar_status" ON "suspicious_activity_reports" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "suspicious_activity_reports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "compliance_events"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sar_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sar_report_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "compliance_event_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "compliance_event_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "compliance_event_type_enum"`);
  }
}
