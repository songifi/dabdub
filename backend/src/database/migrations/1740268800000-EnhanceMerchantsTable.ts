import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class EnhanceMerchantsTable1740268800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── New enum types ──────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE merchant_status_enum AS ENUM (
          'pending', 'active', 'suspended', 'closed', 'inactive', 'terminated'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE kyc_status_enum AS ENUM (
          'not_submitted', 'pending', 'in_review',
          'resubmission_requested', 'approved', 'rejected'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE bank_account_status_enum AS ENUM ('pending', 'verified', 'rejected');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // ── Alter existing status column to use new enum ─────────────────────
    await queryRunner.query(`
      ALTER TABLE merchants
        ALTER COLUMN status TYPE merchant_status_enum
          USING status::text::merchant_status_enum,
        ALTER COLUMN status SET DEFAULT 'pending'
    `);

    // ── Add missing columns ───────────────────────────────────────────────
    await queryRunner.addColumns('merchants', [
      new TableColumn({
        name: 'phone',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
      new TableColumn({ name: 'address', type: 'jsonb', isNullable: true }),
      new TableColumn({
        name: 'kyc_status',
        type: 'kyc_status_enum',
        isNullable: false,
        default: "'not_submitted'",
      }),
      new TableColumn({
        name: 'kyc_rejection_reason',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'kyc_verified_at',
        type: 'timestamptz',
        isNullable: true,
      }),
      new TableColumn({
        name: 'bank_details_encrypted',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'bank_account_status',
        type: 'bank_account_status_enum',
        isNullable: false,
        default: "'pending'",
      }),
      new TableColumn({
        name: 'bank_verified_at',
        type: 'timestamptz',
        isNullable: true,
      }),
      new TableColumn({
        name: 'settings',
        type: 'jsonb',
        isNullable: true,
        default: "'{}'",
      }),
      new TableColumn({
        name: 'settlement_config',
        type: 'jsonb',
        isNullable: true,
      }),
      new TableColumn({
        name: 'fee_structure',
        type: 'jsonb',
        isNullable: true,
      }),
      new TableColumn({
        name: 'supported_chains',
        type: 'text',
        isArray: true,
        isNullable: true,
      }),
      new TableColumn({
        name: 'flags',
        type: 'jsonb',
        isNullable: true,
        default: "'[]'",
      }),
      new TableColumn({
        name: 'email_verification_token',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'api_quota_used',
        type: 'integer',
        default: '0',
        isNullable: false,
      }),
      new TableColumn({
        name: 'api_quota_reset_at',
        type: 'timestamptz',
        isNullable: true,
      }),
      new TableColumn({
        name: 'ip_allowlist_enforced',
        type: 'boolean',
        default: 'false',
        isNullable: false,
      }),
      new TableColumn({ name: 'documents', type: 'jsonb', isNullable: true }),
      new TableColumn({ name: 'created_by', type: 'uuid', isNullable: true }),
      new TableColumn({ name: 'updated_by', type: 'uuid', isNullable: true }),
      new TableColumn({
        name: 'deleted_at',
        type: 'timestamptz',
        isNullable: true,
      }),
      new TableColumn({
        name: 'closed_at',
        type: 'timestamptz',
        isNullable: true,
      }),
      new TableColumn({
        name: 'suspended_at',
        type: 'timestamptz',
        isNullable: true,
      }),
      new TableColumn({ name: 'user_id', type: 'uuid', isNullable: true }),
    ]);

    // ── Ensure timestamptz on standard cols ───────────────────────────────
    await queryRunner.query(`
      ALTER TABLE merchants
        ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC'
    `);

    // ── Indexes ───────────────────────────────────────────────────────────
    await queryRunner.createIndex(
      'merchants',
      new TableIndex({
        name: 'IDX_MERCHANT_EMAIL',
        columnNames: ['email'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'merchants',
      new TableIndex({
        name: 'IDX_MERCHANT_KYC_STATUS',
        columnNames: ['kyc_status'],
      }),
    );
    await queryRunner.createIndex(
      'merchants',
      new TableIndex({ name: 'IDX_MERCHANT_STATUS', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'merchants',
      new TableIndex({
        name: 'IDX_MERCHANT_CREATED_AT',
        columnNames: ['created_at'],
      }),
    );

    // ── FK to users ───────────────────────────────────────────────────────
    await queryRunner.createForeignKey(
      'merchants',
      new TableForeignKey({
        name: 'FK_MERCHANT_USER',
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('merchants', 'FK_MERCHANT_USER');
    await queryRunner.dropIndex('merchants', 'IDX_MERCHANT_CREATED_AT');
    await queryRunner.dropIndex('merchants', 'IDX_MERCHANT_STATUS');
    await queryRunner.dropIndex('merchants', 'IDX_MERCHANT_KYC_STATUS');
    await queryRunner.dropIndex('merchants', 'IDX_MERCHANT_EMAIL');

    const dropCols = [
      'phone',
      'address',
      'kyc_status',
      'kyc_rejection_reason',
      'kyc_verified_at',
      'bank_details_encrypted',
      'bank_account_status',
      'bank_verified_at',
      'settings',
      'settlement_config',
      'fee_structure',
      'supported_chains',
      'flags',
      'email_verification_token',
      'api_quota_used',
      'api_quota_reset_at',
      'ip_allowlist_enforced',
      'documents',
      'created_by',
      'updated_by',
      'deleted_at',
      'closed_at',
      'suspended_at',
      'user_id',
    ];
    for (const col of dropCols) {
      await queryRunner.dropColumn('merchants', col);
    }

    await queryRunner.query(
      `ALTER TABLE merchants ALTER COLUMN status TYPE varchar(50) USING status::text, ALTER COLUMN status SET DEFAULT 'active'`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS kyc_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS bank_account_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS merchant_status_enum`);
  }
}
