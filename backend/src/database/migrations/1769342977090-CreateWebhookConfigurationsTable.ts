import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateWebhookConfigurationsTable1769342977090 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'webhook_configurations',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'url',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'secret',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'events',
            type: 'text',
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'retry_attempts',
            type: 'int',
            default: 3,
          },
          {
            name: 'retry_delay_ms',
            type: 'int',
            default: 1000,
          },
          {
            name: 'timeout_ms',
            type: 'int',
            default: 30000,
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
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_configurations_is_active" ON "webhook_configurations" ("is_active")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_configurations_created_at" ON "webhook_configurations" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('webhook_configurations');
  }
}
