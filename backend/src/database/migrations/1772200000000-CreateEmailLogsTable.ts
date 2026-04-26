import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateEmailLogsTable1772200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'email_logs',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', default: 'uuid_generate_v4()' },
          { name: 'user_id', type: 'varchar', isNullable: true, default: null },
          { name: 'to', type: 'varchar', length: '255' },
          { name: 'template_alias', type: 'varchar', length: '100' },
          { name: 'subject', type: 'varchar', length: '255' },
          { name: 'status', type: 'enum', enum: ['queued', 'sent', 'failed'], default: "'queued'" },
          { name: 'provider_message_id', type: 'varchar', isNullable: true, default: null },
          { name: 'error_message', type: 'text', isNullable: true, default: null },
          { name: 'attempt_count', type: 'int', default: 0 },
          { name: 'sent_at', type: 'timestamptz', isNullable: true, default: null },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'email_logs',
      new TableIndex({ name: 'IDX_email_logs_status', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'email_logs',
      new TableIndex({ name: 'IDX_email_logs_user_id', columnNames: ['user_id'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('email_logs');
  }
}
