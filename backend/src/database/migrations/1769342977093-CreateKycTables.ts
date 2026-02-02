import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKycTables1769342977093 implements MigrationInterface {
  name = 'CreateKycTables1769342977093';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create KYC verifications table
    await queryRunner.query(`
      CREATE TYPE "kyc_verification_status_enum" AS ENUM(
        'not_started', 'documents_pending', 'documents_uploaded', 
        'processing', 'under_review', 'approved', 'rejected', 
        'expired', 'suspended'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "kyc_verification_type_enum" AS ENUM(
        'individual', 'business', 'enhanced'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "risk_level_enum" AS ENUM(
        'low', 'medium', 'high', 'very_high'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "kyc_verifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "merchant_id" uuid NOT NULL,
        "status" "kyc_verification_status_enum" NOT NULL DEFAULT 'not_started',
        "verification_type" "kyc_verification_type_enum" NOT NULL DEFAULT 'individual',
        "risk_level" "risk_level_enum",
        "risk_score" decimal(5,2),
        "first_name" varchar(255),
        "last_name" varchar(255),
        "date_of_birth" date,
        "nationality" varchar(100),
        "phone_number" varchar(50),
        "address_line1" varchar(255),
        "address_line2" varchar(255),
        "city" varchar(100),
        "state_province" varchar(100),
        "postal_code" varchar(20),
        "country" varchar(100),
        "business_name" varchar(255),
        "business_registration_number" varchar(100),
        "business_type" varchar(100),
        "business_country" varchar(100),
        "business_address" text,
        "provider_name" varchar(100),
        "provider_reference" varchar(255),
        "provider_status" varchar(100),
        "provider_response" jsonb,
        "sanctions_checked" boolean NOT NULL DEFAULT false,
        "sanctions_clear" boolean,
        "sanctions_details" jsonb,
        "reviewer_id" uuid,
        "review_notes" text,
        "rejection_reason" text,
        "rejection_code" varchar(50),
        "submitted_at" timestamp,
        "processed_at" timestamp,
        "approved_at" timestamp,
        "rejected_at" timestamp,
        "expires_at" timestamp,
        "next_review_at" timestamp,
        "metadata" jsonb,
        "compliance_flags" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kyc_verifications" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for KYC verifications
    await queryRunner.query(`CREATE INDEX "IDX_kyc_verifications_merchant_id" ON "kyc_verifications" ("merchant_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_kyc_verifications_status" ON "kyc_verifications" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_kyc_verifications_risk_level" ON "kyc_verifications" ("risk_level")`);
    await queryRunner.query(`CREATE INDEX "IDX_kyc_verifications_expires_at" ON "kyc_verifications" ("expires_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_kyc_verifications_created_at" ON "kyc_verifications" ("created_at")`);

    // Create KYC documents table
    await queryRunner.query(`
      CREATE TYPE "document_type_enum" AS ENUM(
        'passport', 'drivers_license', 'national_id', 'utility_bill', 
        'bank_statement', 'business_registration', 'articles_of_incorporation',
        'memorandum_of_association', 'certificate_of_incorporation', 
        'tax_certificate', 'proof_of_address', 'selfie', 'other'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "document_status_enum" AS ENUM(
        'uploaded', 'processing', 'processed', 'verified', 'rejected', 'expired'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "document_quality_enum" AS ENUM(
        'excellent', 'good', 'fair', 'poor'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "kyc_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kyc_verification_id" uuid NOT NULL,
        "document_type" "document_type_enum" NOT NULL,
        "status" "document_status_enum" NOT NULL DEFAULT 'uploaded',
        "file_name" varchar(255) NOT NULL,
        "file_path" varchar(500) NOT NULL,
        "file_size" bigint NOT NULL,
        "mime_type" varchar(100) NOT NULL,
        "file_hash" varchar(128) NOT NULL,
        "quality_score" decimal(5,2),
        "quality_rating" "document_quality_enum",
        "quality_issues" jsonb,
        "ocr_text" text,
        "extracted_data" jsonb,
        "ocr_confidence" decimal(5,2),
        "document_number" varchar(100),
        "issue_date" date,
        "expiry_date" date,
        "issuing_authority" varchar(255),
        "issuing_country" varchar(100),
        "is_authentic" boolean,
        "is_expired" boolean NOT NULL DEFAULT false,
        "verification_provider" varchar(100),
        "verification_reference" varchar(255),
        "verification_result" jsonb,
        "processed_at" timestamp,
        "verified_at" timestamp,
        "expires_at" timestamp,
        "rejection_reason" text,
        "rejection_code" varchar(50),
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kyc_documents" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for KYC documents
    await queryRunner.query(`CREATE INDEX "IDX_kyc_documents_verification_id" ON "kyc_documents" ("kyc_verification_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_kyc_documents_type" ON "kyc_documents" ("document_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_kyc_documents_status" ON "kyc_documents" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_kyc_documents_expires_at" ON "kyc_documents" ("expires_at")`);

    // Create KYC audit logs table
    await queryRunner.query(`
      CREATE TYPE "audit_action_enum" AS ENUM(
        'verification_created', 'document_uploaded', 'document_processed',
        'document_verified', 'document_rejected', 'ocr_completed',
        'identity_verified', 'business_verified', 'sanctions_checked',
        'risk_assessed', 'status_changed', 'manual_review_started',
        'manual_review_completed', 'verification_approved', 'verification_rejected',
        'verification_expired', 'verification_suspended', 'data_updated',
        'compliance_flag_added', 'compliance_flag_removed', 'document_expired',
        're_verification_triggered'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "kyc_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "kyc_verification_id" uuid NOT NULL,
        "action" "audit_action_enum" NOT NULL,
        "user_id" uuid,
        "user_type" varchar(50),
        "description" text NOT NULL,
        "ip_address" inet,
        "user_agent" text,
        "request_id" varchar(100),
        "old_values" jsonb,
        "new_values" jsonb,
        "changed_fields" jsonb,
        "metadata" jsonb,
        "error_details" jsonb,
        "compliance_relevant" boolean NOT NULL DEFAULT true,
        "sensitive_data_accessed" boolean NOT NULL DEFAULT false,
        "data_retention_date" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_kyc_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for KYC audit logs
    await queryRunner.query(`CREATE INDEX "IDX_kyc_audit_logs_verification_id" ON "kyc_audit_logs" ("kyc_verification_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_kyc_audit_logs_action" ON "kyc_audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_kyc_audit_logs_user_id" ON "kyc_audit_logs" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_kyc_audit_logs_created_at" ON "kyc_audit_logs" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_kyc_audit_logs_ip_address" ON "kyc_audit_logs" ("ip_address")`);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "kyc_verifications" 
      ADD CONSTRAINT "FK_kyc_verifications_merchant_id" 
      FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "kyc_documents" 
      ADD CONSTRAINT "FK_kyc_documents_verification_id" 
      FOREIGN KEY ("kyc_verification_id") REFERENCES "kyc_verifications"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "kyc_audit_logs" 
      ADD CONSTRAINT "FK_kyc_audit_logs_verification_id" 
      FOREIGN KEY ("kyc_verification_id") REFERENCES "kyc_verifications"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "kyc_audit_logs" DROP CONSTRAINT "FK_kyc_audit_logs_verification_id"`);
    await queryRunner.query(`ALTER TABLE "kyc_documents" DROP CONSTRAINT "FK_kyc_documents_verification_id"`);
    await queryRunner.query(`ALTER TABLE "kyc_verifications" DROP CONSTRAINT "FK_kyc_verifications_merchant_id"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_kyc_audit_logs_ip_address"`);
    await queryRunner.query(`DROP INDEX "IDX_kyc_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_kyc_audit_logs_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_kyc_audit_logs_action"`);
    await queryRunner.query(`DROP INDEX "IDX_kyc_audit_logs_verification_id"`);

    await queryRunner.query(`DROP INDEX "IDX_kyc_documents_expires_at"`);
    await queryRunner.query(`DROP INDEX "IDX_kyc_documents_status"`);
    await queryRunner.query(`DROP INDEX "IDX_kyc_documents_type"`);
    await queryRunner.query(`DROP INDEX "IDX_kyc_documents_verification_id"`);

    await queryRunner.query(`DROP INDEX "IDX_kyc_verifications_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_kyc_verifications_expires_at"`);
    await queryRunner.query(`DROP INDEX "IDX_kyc_verifications_risk_level"`);
    await queryRunner.query(`DROP INDEX "IDX_kyc_verifications_status"`);
    await queryRunner.query(`DROP INDEX "IDX_kyc_verifications_merchant_id"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "kyc_audit_logs"`);
    await queryRunner.query(`DROP TABLE "kyc_documents"`);
    await queryRunner.query(`DROP TABLE "kyc_verifications"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "audit_action_enum"`);
    await queryRunner.query(`DROP TYPE "document_quality_enum"`);
    await queryRunner.query(`DROP TYPE "document_status_enum"`);
    await queryRunner.query(`DROP TYPE "document_type_enum"`);
    await queryRunner.query(`DROP TYPE "risk_level_enum"`);
    await queryRunner.query(`DROP TYPE "kyc_verification_type_enum"`);
    await queryRunner.query(`DROP TYPE "kyc_verification_status_enum"`);
  }
}