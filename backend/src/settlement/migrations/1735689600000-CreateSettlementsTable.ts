import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateSettlementsTable1735689600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types for PostgreSQL
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE settlement_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE settlement_provider_enum AS ENUM ('stripe', 'bank_api', 'wise', 'paypal', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.createTable(
      new Table({
        name: 'settlements',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'payment_request_id',
            type: 'uuid',
            isUnique: true,
          },
          {
            name: 'merchant_id',
            type: 'uuid',
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 19,
            scale: 4,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
          },
          {
            name: 'status',
            type: 'settlement_status_enum',
            default: "'pending'",
          },
          {
            name: 'bank_account_number',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'bank_routing_number',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'bank_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'bank_account_holder_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'bank_swift_code',
            type: 'varchar',
            length: '11',
            isNullable: true,
          },
          {
            name: 'bank_iban',
            type: 'varchar',
            length: '34',
            isNullable: true,
          },
          {
            name: 'batch_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'batch_sequence',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'fee_amount',
            type: 'decimal',
            precision: 19,
            scale: 4,
            default: 0,
          },
          {
            name: 'fee_percentage',
            type: 'decimal',
            precision: 5,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'net_amount',
            type: 'decimal',
            precision: 19,
            scale: 4,
          },
          {
            name: 'exchange_rate',
            type: 'decimal',
            precision: 19,
            scale: 8,
            isNullable: true,
          },
          {
            name: 'source_currency',
            type: 'varchar',
            length: '3',
            isNullable: true,
          },
          {
            name: 'provider',
            type: 'settlement_provider_enum',
            isNullable: true,
          },
          {
            name: 'provider_reference',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'settlement_receipt',
            type: 'varchar',
            length: '255',
            isNullable: true,
            isUnique: true,
          },
          {
            name: 'settlement_reference',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'failure_reason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'retry_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'max_retries',
            type: 'int',
            default: 3,
          },
          {
            name: 'settled_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'processed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'settlements',
      new TableIndex({
        name: 'IDX_SETTLEMENTS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'settlements',
      new TableIndex({
        name: 'IDX_SETTLEMENTS_MERCHANT_ID',
        columnNames: ['merchant_id'],
      }),
    );

    await queryRunner.createIndex(
      'settlements',
      new TableIndex({
        name: 'IDX_SETTLEMENTS_SETTLED_AT',
        columnNames: ['settled_at'],
      }),
    );

    await queryRunner.createIndex(
      'settlements',
      new TableIndex({
        name: 'IDX_SETTLEMENTS_PAYMENT_REQUEST_ID',
        columnNames: ['payment_request_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'settlements',
      new TableIndex({
        name: 'IDX_SETTLEMENTS_BATCH_ID',
        columnNames: ['batch_id'],
      }),
    );

    // Note: Foreign key constraints will be added once PaymentRequest and Merchant tables exist
    // await queryRunner.createForeignKey(
    //   'settlements',
    //   new TableForeignKey({
    //     columnNames: ['payment_request_id'],
    //     referencedColumnNames: ['id'],
    //     referencedTableName: 'payment_requests',
    //     onDelete: 'CASCADE',
    //   }),
    // );

    // await queryRunner.createForeignKey(
    //   'settlements',
    //   new TableForeignKey({
    //     columnNames: ['merchant_id'],
    //     referencedColumnNames: ['id'],
    //     referencedTableName: 'merchants',
    //     onDelete: 'CASCADE',
    //   }),
    // );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('settlements');

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS settlement_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS settlement_provider_enum;`);
  }
}
