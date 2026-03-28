import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateTransactionsTable1740446400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: [
              'deposit',
              'withdrawal',
              'transfer_in',
              'transfer_out',
              'paylink_received',
              'paylink_sent',
              'stake',
              'unstake',
              'yield_credit',
            ],
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'fee',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'balance_after',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'completed', 'failed'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'reference',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'counterparty_username',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'note',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'",
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'idx_transactions_user_id_created_at_desc',
        columnNames: ['user_id', 'created_at'],
        isUnique: false,
      }),
    );

    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'idx_transactions_user_id_type_created_at_desc',
        columnNames: ['user_id', 'type', 'created_at'],
        isUnique: false,
      }),
    );

    await queryRunner.createIndex(
      'transactions',
      new TableIndex({
        name: 'idx_transactions_reference',
        columnNames: ['reference'],
        isUnique: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('transactions', true);
  }
}
