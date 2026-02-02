import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateEvmTransactionsTable1738267200004
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'evm_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'txHash',
            type: 'varchar',
            length: '66',
            isUnique: true,
          },
          {
            name: 'fromAddress',
            type: 'varchar',
            length: '42',
          },
          {
            name: 'toAddress',
            type: 'varchar',
            length: '42',
          },
          {
            name: 'amount',
            type: 'varchar',
            length: '78',
            comment: 'Stored as wei/smallest unit string',
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '10',
          },
          {
            name: 'chain',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'nonce',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'gasPrice',
            type: 'varchar',
            length: '78',
            isNullable: true,
          },
          {
            name: 'gasUsed',
            type: 'varchar',
            length: '78',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'confirmed', 'failed', 'dropped', 'replaced'],
            default: "'pending'",
          },
          {
            name: 'blockNumber',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'confirmations',
            type: 'integer',
            default: 0,
          },
          {
            name: 'error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('evm_transactions');
  }
}
