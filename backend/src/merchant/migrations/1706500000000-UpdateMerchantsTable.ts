import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateMerchantsTable1706500000000 implements MigrationInterface {
    name = 'UpdateMerchantsTable1706500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add new enum types
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."kyc_status_enum" AS ENUM('not_started', 'pending', 'in_review', 'approved', 'rejected', 'expired');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."business_type_enum" AS ENUM('individual', 'sole_proprietorship', 'partnership', 'llc', 'corporation', 'non_profit');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."bank_account_status_enum" AS ENUM('not_verified', 'pending', 'verified', 'failed');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // Update merchant status enum to include new values
        await queryRunner.query(`
            ALTER TYPE "public"."merchants_status_enum" ADD VALUE IF NOT EXISTS 'pending';
        `);
        await queryRunner.query(`
            ALTER TYPE "public"."merchants_status_enum" ADD VALUE IF NOT EXISTS 'closed';
        `);

        // Add new columns to merchants table
        await queryRunner.query(`
            ALTER TABLE "merchants"
            ADD COLUMN IF NOT EXISTS "password_hash" varchar(255),
            ADD COLUMN IF NOT EXISTS "phone" varchar(50),
            ADD COLUMN IF NOT EXISTS "website" varchar(500),
            ADD COLUMN IF NOT EXISTS "business_type" "public"."business_type_enum",
            ADD COLUMN IF NOT EXISTS "business_registration_number" varchar(100),
            ADD COLUMN IF NOT EXISTS "tax_id" varchar(100),
            ADD COLUMN IF NOT EXISTS "business_description" text,
            ADD COLUMN IF NOT EXISTS "business_category" varchar(100),
            ADD COLUMN IF NOT EXISTS "address_line1" varchar(255),
            ADD COLUMN IF NOT EXISTS "address_line2" varchar(255),
            ADD COLUMN IF NOT EXISTS "city" varchar(100),
            ADD COLUMN IF NOT EXISTS "state" varchar(100),
            ADD COLUMN IF NOT EXISTS "postal_code" varchar(20),
            ADD COLUMN IF NOT EXISTS "country" varchar(2),
            ADD COLUMN IF NOT EXISTS "kyc_status" "public"."kyc_status_enum" DEFAULT 'not_started',
            ADD COLUMN IF NOT EXISTS "kyc_submitted_at" timestamp,
            ADD COLUMN IF NOT EXISTS "kyc_verified_at" timestamp,
            ADD COLUMN IF NOT EXISTS "kyc_rejection_reason" text,
            ADD COLUMN IF NOT EXISTS "kyc_documents" jsonb,
            ADD COLUMN IF NOT EXISTS "email_verified" boolean DEFAULT false,
            ADD COLUMN IF NOT EXISTS "email_verification_token" varchar(255),
            ADD COLUMN IF NOT EXISTS "email_verification_expires_at" timestamp,
            ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp,
            ADD COLUMN IF NOT EXISTS "bank_account_number" varchar(50),
            ADD COLUMN IF NOT EXISTS "bank_routing_number" varchar(50),
            ADD COLUMN IF NOT EXISTS "bank_account_holder_name" varchar(255),
            ADD COLUMN IF NOT EXISTS "bank_name" varchar(255),
            ADD COLUMN IF NOT EXISTS "bank_swift_code" varchar(20),
            ADD COLUMN IF NOT EXISTS "bank_iban" varchar(50),
            ADD COLUMN IF NOT EXISTS "bank_account_status" "public"."bank_account_status_enum" DEFAULT 'not_verified',
            ADD COLUMN IF NOT EXISTS "bank_verified_at" timestamp,
            ADD COLUMN IF NOT EXISTS "supported_currencies" jsonb DEFAULT '["USD"]',
            ADD COLUMN IF NOT EXISTS "default_currency" varchar(3) DEFAULT 'USD',
            ADD COLUMN IF NOT EXISTS "settlement_frequency" varchar(20) DEFAULT 'daily',
            ADD COLUMN IF NOT EXISTS "minimum_settlement_amount" decimal(19,4) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "auto_settlement_enabled" boolean DEFAULT true,
            ADD COLUMN IF NOT EXISTS "notification_preferences" jsonb,
            ADD COLUMN IF NOT EXISTS "api_quota_limit" int DEFAULT 1000,
            ADD COLUMN IF NOT EXISTS "api_quota_used" int DEFAULT 0,
            ADD COLUMN IF NOT EXISTS "api_quota_reset_at" timestamp,
            ADD COLUMN IF NOT EXISTS "metadata" jsonb,
            ADD COLUMN IF NOT EXISTS "suspension_reason" text,
            ADD COLUMN IF NOT EXISTS "closed_at" timestamp,
            ADD COLUMN IF NOT EXISTS "closed_reason" text
        `);

        // Create indexes
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_merchants_status" ON "merchants" ("status")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_merchants_kyc_status" ON "merchants" ("kyc_status")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_merchants_created_at" ON "merchants" ("created_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_merchants_created_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_merchants_kyc_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_merchants_status"`);

        // Drop columns
        await queryRunner.query(`
            ALTER TABLE "merchants"
            DROP COLUMN IF EXISTS "password_hash",
            DROP COLUMN IF EXISTS "phone",
            DROP COLUMN IF EXISTS "website",
            DROP COLUMN IF EXISTS "business_type",
            DROP COLUMN IF EXISTS "business_registration_number",
            DROP COLUMN IF EXISTS "tax_id",
            DROP COLUMN IF EXISTS "business_description",
            DROP COLUMN IF EXISTS "business_category",
            DROP COLUMN IF EXISTS "address_line1",
            DROP COLUMN IF EXISTS "address_line2",
            DROP COLUMN IF EXISTS "city",
            DROP COLUMN IF EXISTS "state",
            DROP COLUMN IF EXISTS "postal_code",
            DROP COLUMN IF EXISTS "country",
            DROP COLUMN IF EXISTS "kyc_status",
            DROP COLUMN IF EXISTS "kyc_submitted_at",
            DROP COLUMN IF EXISTS "kyc_verified_at",
            DROP COLUMN IF EXISTS "kyc_rejection_reason",
            DROP COLUMN IF EXISTS "kyc_documents",
            DROP COLUMN IF EXISTS "email_verified",
            DROP COLUMN IF EXISTS "email_verification_token",
            DROP COLUMN IF EXISTS "email_verification_expires_at",
            DROP COLUMN IF EXISTS "email_verified_at",
            DROP COLUMN IF EXISTS "bank_account_number",
            DROP COLUMN IF EXISTS "bank_routing_number",
            DROP COLUMN IF EXISTS "bank_account_holder_name",
            DROP COLUMN IF EXISTS "bank_name",
            DROP COLUMN IF EXISTS "bank_swift_code",
            DROP COLUMN IF EXISTS "bank_iban",
            DROP COLUMN IF EXISTS "bank_account_status",
            DROP COLUMN IF EXISTS "bank_verified_at",
            DROP COLUMN IF EXISTS "supported_currencies",
            DROP COLUMN IF EXISTS "default_currency",
            DROP COLUMN IF EXISTS "settlement_frequency",
            DROP COLUMN IF EXISTS "minimum_settlement_amount",
            DROP COLUMN IF EXISTS "auto_settlement_enabled",
            DROP COLUMN IF EXISTS "notification_preferences",
            DROP COLUMN IF EXISTS "api_quota_limit",
            DROP COLUMN IF EXISTS "api_quota_used",
            DROP COLUMN IF EXISTS "api_quota_reset_at",
            DROP COLUMN IF EXISTS "metadata",
            DROP COLUMN IF EXISTS "suspension_reason",
            DROP COLUMN IF EXISTS "closed_at",
            DROP COLUMN IF EXISTS "closed_reason"
        `);

        // Drop enum types
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."bank_account_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."business_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."kyc_status_enum"`);
    }
}
