import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAuditLogTable1772200000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'audit_logs',
      columns: [
        {
          name: 'id',
          type: 'uuid',
          isPrimary: true,
          isGenerated: true,
          generationStrategy: 'uuid',
        },
        {
          name: 'actor',
          type: 'varchar',
        },
        {
          name: 'action',
          type: 'varchar',
        },
        {
          name: 'resource',
          type: 'varchar',
        },
        {
          name: 'before',
          type: 'jsonb',
          isNullable: true,
        },
        {
          name: 'after',
          type: 'jsonb',
          isNullable: true,
        },
        {
          name: 'ip',
          type: 'varchar',
          isNullable: true,
        },
        {
          name: 'created_at',
          type: 'timestamp',
          default: 'now()',
        },
      ],
    }), true);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_modification()
      RETURNS TRIGGER AS $$
      BEGIN
          RAISE EXCEPTION 'Updates and Deletes are not allowed on the audit_logs table.';
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_prevent_audit_modifications
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_modification();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_prevent_audit_modifications ON audit_logs`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS prevent_audit_modification()`);
    await queryRunner.dropTable('audit_logs');
  }
}
