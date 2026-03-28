import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReportJobs1769600000000 implements MigrationInterface {
  name = 'CreateReportJobs1769600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "report_type_enum" AS ENUM (
        'user_transactions', 'merchant_settlements', 'fee_summary',
        'kyc_submissions', 'waitlist_export'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "report_status_enum" AS ENUM ('queued', 'processing', 'ready', 'failed')
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_jobs" (
        "id"            uuid                  NOT NULL DEFAULT uuid_generate_v4(),
        "requested_by"  uuid                  NOT NULL,
        "type"          "report_type_enum"    NOT NULL,
        "params"        jsonb                 NOT NULL DEFAULT '{}',
        "status"        "report_status_enum"  NOT NULL DEFAULT 'queued',
        "file_key"      text                  DEFAULT NULL,
        "file_url"      text                  DEFAULT NULL,
        "expires_at"    TIMESTAMPTZ           DEFAULT NULL,
        "error_message" text                  DEFAULT NULL,
        "created_at"    TIMESTAMPTZ           NOT NULL DEFAULT now(),
        "updated_at"    TIMESTAMPTZ           NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_jobs_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_report_jobs_requested_by" ON "report_jobs" ("requested_by")`);
    await queryRunner.query(`CREATE INDEX "IDX_report_jobs_status"       ON "report_jobs" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_report_jobs_expires_at"   ON "report_jobs" ("expires_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_jobs"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "report_type_enum"`);
  }
}
