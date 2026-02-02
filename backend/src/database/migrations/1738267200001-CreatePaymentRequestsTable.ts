import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreatePaymentRequestsTable1738267200001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'payment_requests',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'merchant_id',
            type: 'uuid',
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 19,
            scale: 7,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
          },
          {
            name: 'status',
            type: 'enum',
            enum: [
              'pending',
              'processing',
              'completed',
              'failed',
              'cancelled',
              'expired',
              'refunded',
            ],
            default: "'pending'",
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['payment', 'refund'],
            default: "'payment'",
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'stellar_network',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'on_chain_payment_id',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'on_chain_tx_hash',
            type: 'varchar',
            length: '128',
            isNullable: true,
          },
          {
            name: 'user_wallet_address',
            type: 'varchar',
            length: '56',
            isNullable: true,
          },
          {
            name: 'fee_amount',
            type: 'decimal',
            precision: 19,
            scale: 7,
            default: 0,
          },
          {
            name: 'customer_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'customer_email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'customer_phone',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'cancelled_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'idempotency_key',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'qr_code_data',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status_history',
            type: 'jsonb',
            default: "'[]'",
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('payment_requests');
  }
}
