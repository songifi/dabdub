import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWaitlistEntries1769400000000 implements MigrationInterface {
  name = 'CreateWaitlistEntries1769400000000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("SET lock_timeout = '5s'");
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "waitlist_entries" (
        "id"               uuid          NOT NULL DEFAULT uuid_generate_v4(),
        "email"            varchar(255)  NOT NULL,
        "name"             varchar(100)  NOT NULL,
        "referral_code"    varchar(16)   NOT NULL,
        "referred_by_code" varchar(16)   DEFAULT NULL,
        "points"           integer       NOT NULL DEFAULT 100,
        "ip_address"       varchar(45)   NOT NULL,
        "fingerprint"      varchar(255)  DEFAULT NULL,
        "is_fraud_flagged" boolean       NOT NULL DEFAULT false,
        "joined_at"        TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "updated_at"       TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_waitlist_entries_id"           PRIMARY KEY ("id"),
        CONSTRAINT "UQ_waitlist_entries_email"        UNIQUE ("email"),
        CONSTRAINT "UQ_waitlist_entries_referral_code" UNIQUE ("referral_code")
      )
    `);
    await queryRunner.query(`CREATE INDEX CONCURRENTLY "IDX_waitlist_entries_ip" ON "waitlist_entries" ("ip_address")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "waitlist_entries"`);
  }
}
