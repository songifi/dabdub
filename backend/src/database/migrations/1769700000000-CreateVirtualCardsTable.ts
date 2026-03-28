import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateVirtualCardsTable1769700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create virtual_cards table
    await queryRunner.createTable(
      new Table({
        name: 'virtual_cards',
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
            name: 'sudo_card_id',
            type: 'varchar',
            length: '100',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'last4',
            type: 'varchar',
            length: '4',
            isNullable: false,
          },
          {
            name: 'brand',
            type: 'enum',
            enum: ['visa', 'mastercard'],
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '10',
            default: "'USD'",
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'frozen', 'terminated'],
            default: "'active'",
            isNullable: false,
          },
          {
            name: 'spending_limit',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'balance',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'billing_address',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'terminated_at',
            type: 'timestamptz',
            isNullable: true,
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
      'virtual_cards',
      new TableIndex({
        name: 'IDX_virtual_cards_user_id',
        columnNames: ['user_id'],
      }),
    );

    await queryRunner.createIndex(
      'virtual_cards',
      new TableIndex({
        name: 'IDX_virtual_cards_sudo_card_id',
        columnNames: ['sudo_card_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'virtual_cards',
      new TableIndex({
        name: 'IDX_virtual_cards_status',
        columnNames: ['status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop virtual_cards table
    await queryRunner.dropTable('virtual_cards', true);

    // Note: Dropping enum values from PostgreSQL requires dropping and recreating the type
    // For simplicity, we'll leave the transaction types as they are
  }
}
