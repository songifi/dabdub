import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKycSubmissions1769500000000 implements MigrationInterface {
  name = 'CreateKycSubmissions1769500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "kyc_submission_status_enum" AS ENUM ('pending', 'under_review', 'approved', 'rejected')
    `);
    await queryRunner.query(`
      CREATE TYPE "kyc_document_type_enum" AS ENUM ('id', 'passport', 'dl')
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "kyc_submissions" (
        "id"                  uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"             uuid          NOT NULL,
        "target_tier"         varchar(10)   NOT NULL,
        "status"              "kyc_submission_status_enum" NOT NULL DEFAULT 'pending',
        "bvn_last4"           varchar(4)    NOT NULL,
        "nin_last4"           varchar(4)    NOT NULL,
        "document_type"       "kyc_document_type_enum" NOT NULL,
        "document_front_key"  text          NOT NULL,
        "document_back_key"   text          DEFAULT NULL,
        "selfie_key"          text          NOT NULL,
        "review_note"         text          DEFAULT NULL,
        "reviewed_by"         uuid          DEFAULT NULL,
        "reviewed_at"         TIMESTAMPTZ   DEFAULT NULL,
        "created_at"          TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"          TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kyc_submissions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_kyc_submissions_user_id" ON "kyc_submissions" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_kyc_submissions_status"  ON "kyc_submissions" ("status")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "kyc_submissions"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "kyc_submission_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "kyc_document_type_enum"`);
  }
}
