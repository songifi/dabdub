import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateInAppNotifications1772200000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'in_app_notifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'merchantId', type: 'uuid' },
          { name: 'type', type: 'varchar', length: '100' },
          { name: 'message', type: 'text' },
          { name: 'read', type: 'boolean', default: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'in_app_notifications',
      new TableIndex({
        name: 'IDX_in_app_notifications_merchant_read',
        columnNames: ['merchantId', 'read'],
      }),
    );

    await queryRunner.createIndex(
      'in_app_notifications',
      new TableIndex({
        name: 'IDX_in_app_notifications_merchant_created',
        columnNames: ['merchantId', 'createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('in_app_notifications');
  }
}
