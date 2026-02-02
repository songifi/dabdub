import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class AddForeignKeyConstraints1738267200006
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Payment Requests -> Merchants
    await queryRunner.createForeignKey(
      'payment_requests',
      new TableForeignKey({
        name: 'FK_payment_requests_merchants',
        columnNames: ['merchant_id'],
        referencedTableName: 'merchants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Settlements -> Merchants
    await queryRunner.createForeignKey(
      'settlements',
      new TableForeignKey({
        name: 'FK_settlements_merchants',
        columnNames: ['merchant_id'],
        referencedTableName: 'merchants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );

    // Settlements -> Payment Requests
    await queryRunner.createForeignKey(
      'settlements',
      new TableForeignKey({
        name: 'FK_settlements_payment_requests',
        columnNames: ['payment_request_id'],
        referencedTableName: 'payment_requests',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );

    // Wallets -> Users
    await queryRunner.createForeignKey(
      'wallets',
      new TableForeignKey({
        name: 'FK_wallets_users',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys in reverse order
    await queryRunner.dropForeignKey('wallets', 'FK_wallets_users');
    await queryRunner.dropForeignKey(
      'settlements',
      'FK_settlements_payment_requests',
    );
    await queryRunner.dropForeignKey('settlements', 'FK_settlements_merchants');
    await queryRunner.dropForeignKey(
      'payment_requests',
      'FK_payment_requests_merchants',
    );
  }
}
