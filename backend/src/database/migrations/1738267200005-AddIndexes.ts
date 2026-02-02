import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddIndexes1738267200005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Payment Requests Indexes
    await queryRunner.createIndex(
      'payment_requests',
      new TableIndex({
        name: 'IDX_payment_requests_merchant_id',
        columnNames: ['merchant_id'],
      }),
    );

    await queryRunner.createIndex(
      'payment_requests',
      new TableIndex({
        name: 'IDX_payment_requests_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'payment_requests',
      new TableIndex({
        name: 'IDX_payment_requests_created_at',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createIndex(
      'payment_requests',
      new TableIndex({
        name: 'IDX_payment_requests_expires_at',
        columnNames: ['expires_at'],
      }),
    );

    await queryRunner.createIndex(
      'payment_requests',
      new TableIndex({
        name: 'IDX_payment_requests_stellar_network',
        columnNames: ['stellar_network'],
      }),
    );

    await queryRunner.createIndex(
      'payment_requests',
      new TableIndex({
        name: 'IDX_payment_requests_customer_email',
        columnNames: ['customer_email'],
      }),
    );

    await queryRunner.createIndex(
      'payment_requests',
      new TableIndex({
        name: 'UQ_payment_requests_idempotency_key',
        columnNames: ['idempotency_key'],
        isUnique: true,
        where: 'idempotency_key IS NOT NULL',
      }),
    );

    await queryRunner.createIndex(
      'payment_requests',
      new TableIndex({
        name: 'UQ_payment_requests_on_chain_payment_id',
        columnNames: ['on_chain_payment_id'],
        isUnique: true,
        where: 'on_chain_payment_id IS NOT NULL',
      }),
    );

    // Composite indexes for common queries
    await queryRunner.createIndex(
      'payment_requests',
      new TableIndex({
        name: 'IDX_payment_requests_merchant_status',
        columnNames: ['merchant_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'payment_requests',
      new TableIndex({
        name: 'IDX_payment_requests_merchant_created',
        columnNames: ['merchant_id', 'created_at'],
      }),
    );

    // Settlements Indexes
    await queryRunner.createIndex(
      'settlements',
      new TableIndex({
        name: 'IDX_settlements_merchant_id',
        columnNames: ['merchant_id'],
      }),
    );

    await queryRunner.createIndex(
      'settlements',
      new TableIndex({
        name: 'IDX_settlements_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'settlements',
      new TableIndex({
        name: 'IDX_settlements_created_at',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createIndex(
      'settlements',
      new TableIndex({
        name: 'IDX_settlements_payment_request_id',
        columnNames: ['payment_request_id'],
      }),
    );

    // Merchants Indexes
    await queryRunner.createIndex(
      'merchants',
      new TableIndex({
        name: 'IDX_merchants_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'merchants',
      new TableIndex({
        name: 'IDX_merchants_created_at',
        columnNames: ['created_at'],
      }),
    );

    // Users Indexes
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_users_email',
        columnNames: ['email'],
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_users_created_at',
        columnNames: ['created_at'],
      }),
    );

    // Payments Indexes
    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_payments_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_payments_network',
        columnNames: ['network'],
      }),
    );

    await queryRunner.createIndex(
      'payments',
      new TableIndex({
        name: 'IDX_payments_created_at',
        columnNames: ['createdAt'],
      }),
    );

    // EVM Transactions Indexes
    await queryRunner.createIndex(
      'evm_transactions',
      new TableIndex({
        name: 'IDX_evm_transactions_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'evm_transactions',
      new TableIndex({
        name: 'IDX_evm_transactions_chain',
        columnNames: ['chain'],
      }),
    );

    await queryRunner.createIndex(
      'evm_transactions',
      new TableIndex({
        name: 'IDX_evm_transactions_from_address',
        columnNames: ['fromAddress'],
      }),
    );

    await queryRunner.createIndex(
      'evm_transactions',
      new TableIndex({
        name: 'IDX_evm_transactions_to_address',
        columnNames: ['toAddress'],
      }),
    );

    await queryRunner.createIndex(
      'evm_transactions',
      new TableIndex({
        name: 'IDX_evm_transactions_created_at',
        columnNames: ['createdAt'],
      }),
    );

    // Wallets Indexes
    await queryRunner.createIndex(
      'wallets',
      new TableIndex({
        name: 'IDX_wallets_address',
        columnNames: ['address'],
      }),
    );

    await queryRunner.createIndex(
      'wallets',
      new TableIndex({
        name: 'IDX_wallets_chain',
        columnNames: ['chain'],
      }),
    );

    await queryRunner.createIndex(
      'wallets',
      new TableIndex({
        name: 'IDX_wallets_type',
        columnNames: ['type'],
      }),
    );

    await queryRunner.createIndex(
      'wallets',
      new TableIndex({
        name: 'IDX_wallets_user_id',
        columnNames: ['userId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all indexes in reverse order
    const indexes = [
      // Wallets
      'IDX_wallets_user_id',
      'IDX_wallets_type',
      'IDX_wallets_chain',
      'IDX_wallets_address',
      // EVM Transactions
      'IDX_evm_transactions_created_at',
      'IDX_evm_transactions_to_address',
      'IDX_evm_transactions_from_address',
      'IDX_evm_transactions_chain',
      'IDX_evm_transactions_status',
      // Payments
      'IDX_payments_created_at',
      'IDX_payments_network',
      'IDX_payments_status',
      // Users
      'IDX_users_created_at',
      'IDX_users_email',
      // Merchants
      'IDX_merchants_created_at',
      'IDX_merchants_status',
      // Settlements
      'IDX_settlements_payment_request_id',
      'IDX_settlements_created_at',
      'IDX_settlements_status',
      'IDX_settlements_merchant_id',
      // Payment Requests
      'IDX_payment_requests_merchant_created',
      'IDX_payment_requests_merchant_status',
      'UQ_payment_requests_on_chain_payment_id',
      'UQ_payment_requests_idempotency_key',
      'IDX_payment_requests_customer_email',
      'IDX_payment_requests_stellar_network',
      'IDX_payment_requests_expires_at',
      'IDX_payment_requests_created_at',
      'IDX_payment_requests_status',
      'IDX_payment_requests_merchant_id',
    ];

    for (const indexName of indexes) {
      const tableName = indexName.split('_')[1] + '_' + indexName.split('_')[2];
      await queryRunner.dropIndex(tableName, indexName);
    }
  }
}
