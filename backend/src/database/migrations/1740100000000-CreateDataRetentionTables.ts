import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateDataRetentionTables1740100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'data_retention_policies',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'data_type',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'retention_days',
            type: 'int',
          },
          {
            name: 'is_enabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'legal_basis',
            type: 'text',
          },
          {
            name: 'archive_before_delete',
            type: 'boolean',
            default: false,
          },
          {
            name: 'last_purge_run_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'last_purge_deleted_count',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'data_deletion_requests',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'merchant_id',
            type: 'uuid',
          },
          {
            name: 'status',
            type: 'enum',
            enum: [
              'RECEIVED',
              'UNDER_REVIEW',
              'LEGAL_HOLD',
              'APPROVED',
              'PROCESSING',
              'COMPLETED',
              'REJECTED',
            ],
          },
          {
            name: 'request_reason',
            type: 'text',
          },
          {
            name: 'reviewed_by_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'review_note',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'legal_hold_expires_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'deleted_data_summary',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'deleted_at',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'data_deletion_requests',
      new TableIndex({
        name: 'IDX_deletion_requests_merchant_id',
        columnNames: ['merchant_id'],
      }),
    );

    await queryRunner.createIndex(
      'data_deletion_requests',
      new TableIndex({
        name: 'IDX_deletion_requests_status',
        columnNames: ['status'],
      }),
    );

    // Insert default retention policies
    await queryRunner.query(`
      INSERT INTO data_retention_policies (data_type, retention_days, legal_basis, archive_before_delete)
      VALUES
        ('transaction_records', 2555, 'Financial regulations require 7-year retention for transaction records', true),
        ('audit_logs', 2555, 'Compliance and security audit requirements', true),
        ('webhook_deliveries', 90, 'Operational debugging and monitoring purposes', false),
        ('support_tickets', 1095, 'Customer service quality and legal protection', false),
        ('kyc_documents', 2555, 'Anti-money laundering and KYC regulations', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('data_deletion_requests');
    await queryRunner.dropTable('data_retention_policies');
  }
}
