import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateWalletsTable1738267200003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'wallets',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'address',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'privateKey',
            type: 'text',
            comment: 'Encrypted private key',
          },
          {
            name: 'chain',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['deposit', 'treasury'],
            default: "'deposit'",
          },
          {
            name: 'userId',
            type: 'uuid',
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
    await queryRunner.dropTable('wallets');
  }
}
