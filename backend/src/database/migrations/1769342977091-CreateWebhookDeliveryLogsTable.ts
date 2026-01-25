import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateWebhookDeliveryLogsTable1769342977091 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'webhook_delivery_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'webhook_config_id',
            type: 'uuid',
          },
          {
            name: 'payment_request_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'event',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'payload',
            type: 'jsonb',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'sent', 'delivered', 'failed'],
            default: "'pending'",
          },
          {
            name: 'attempt_number',
            type: 'int',
            default: 1,
          },
          {
            name: 'max_attempts',
            type: 'int',
            default: 3,
          },
          {
            name: 'response_time_ms',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'http_status_code',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'request_headers',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'request_body',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'response_headers',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'response_body',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'payload_snapshot',
            type: 'bytea',
            isNullable: true,
          },
          {
            name: 'sent_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'delivered_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'failed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'next_retry_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'retention_days',
            type: 'int',
            default: 30,
          },
          {
            name: 'debug_info',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'user_agent',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'ip_address',
            type: 'inet',
            isNullable: true,
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
      CREATE INDEX "IDX_webhook_delivery_logs_webhook_config_id" ON "webhook_delivery_logs" ("webhook_config_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_delivery_logs_status" ON "webhook_delivery_logs" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_delivery_logs_created_at" ON "webhook_delivery_logs" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_delivery_logs_config_status" ON "webhook_delivery_logs" ("webhook_config_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_webhook_delivery_logs_config_created" ON "webhook_delivery_logs" ("webhook_config_id", "created_at")
    `);

    // Create foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "webhook_delivery_logs"
      ADD CONSTRAINT "FK_webhook_delivery_logs_webhook_config_id"
      FOREIGN KEY ("webhook_config_id") REFERENCES "webhook_configurations"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "webhook_delivery_logs" DROP CONSTRAINT "FK_webhook_delivery_logs_webhook_config_id"
    `);
    await queryRunner.dropTable('webhook_delivery_logs');
  }
}
