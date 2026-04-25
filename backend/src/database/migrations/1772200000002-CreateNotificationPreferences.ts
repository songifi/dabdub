import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateNotificationPreferences1772200000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "notification_channel_enum" AS ENUM ('email', 'push', 'in_app')
    `);

    await queryRunner.query(`
      CREATE TYPE "notification_event_type_enum" AS ENUM (
        'payment.confirmed',
        'payment.settled',
        'settlement.failed'
      )
    `);

    await queryRunner.createTable(
      new Table({
        name: 'notification_preferences',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'merchant_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'channel',
            type: 'enum',
            enumName: 'notification_channel_enum',
            isNullable: false,
          },
          {
            name: 'event_type',
            type: 'enum',
            enumName: 'notification_event_type_enum',
            isNullable: false,
          },
          {
            name: 'enabled',
            type: 'boolean',
            default: true,
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
        ],
      }),
      true,
    );

    // Unique constraint: one row per merchant × channel × event
    await queryRunner.createIndex(
      'notification_preferences',
      new TableIndex({
        name: 'UQ_notif_pref_merchant_channel_event',
        columnNames: ['merchant_id', 'channel', 'event_type'],
        isUnique: true,
      }),
    );

    // Index for fast lookups by merchant
    await queryRunner.createIndex(
      'notification_preferences',
      new TableIndex({
        name: 'IDX_notif_pref_merchant_id',
        columnNames: ['merchant_id'],
      }),
    );

    await queryRunner.createForeignKey(
      'notification_preferences',
      new TableForeignKey({
        name: 'FK_notif_pref_merchant',
        columnNames: ['merchant_id'],
        referencedTableName: 'merchants',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('notification_preferences', 'FK_notif_pref_merchant');
    await queryRunner.dropIndex('notification_preferences', 'IDX_notif_pref_merchant_id');
    await queryRunner.dropIndex('notification_preferences', 'UQ_notif_pref_merchant_channel_event');
    await queryRunner.dropTable('notification_preferences');
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_event_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_channel_enum"`);
  }
}
