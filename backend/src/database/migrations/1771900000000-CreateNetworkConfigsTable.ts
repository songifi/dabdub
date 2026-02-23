import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateNetworkConfigsTable1771900000000 implements MigrationInterface {
  name = 'CreateNetworkConfigsTable1771900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'network_status_enum' AND n.nspname = 'public'
        ) THEN
          CREATE TYPE "public"."network_status_enum" AS ENUM ('active', 'maintenance', 'deprecated');
        END IF;
      END
      $$;
    `);

    await queryRunner.createTable(
      new Table({
        name: 'network_configs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'network', type: 'varchar', length: '100', isUnique: true },
          { name: 'rpc_url', type: 'text' },
          { name: 'chain_id', type: 'int' },
          { name: 'is_active', type: 'boolean', default: true },
          { name: 'block_time', type: 'int', isNullable: true },
          {
            name: 'status',
            type: 'enum',
            enumName: 'network_status_enum',
            enum: ['active', 'maintenance', 'deprecated'],
            default: "'active'",
          },
          {
            name: 'usdc_contract_address',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'settlement_contract_address',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'required_confirmations', type: 'int', default: 12 },
          {
            name: 'current_gas_price',
            type: 'decimal',
            precision: 20,
            scale: 8,
            isNullable: true,
          },
          {
            name: 'max_gas_price',
            type: 'decimal',
            precision: 20,
            scale: 8,
            isNullable: true,
          },
          { name: 'last_block_number', type: 'int', isNullable: true },
          { name: 'last_health_check', type: 'timestamp', isNullable: true },
          { name: 'is_healthy', type: 'boolean', default: true },
          { name: 'fallback_rpc_urls', type: 'text', isNullable: true },
          { name: 'last_scanned_block', type: 'int', isNullable: true },
          {
            name: 'base_fee_per_gas',
            type: 'decimal',
            precision: 20,
            scale: 8,
            isNullable: true,
          },
          {
            name: 'priority_fee_per_gas',
            type: 'decimal',
            precision: 20,
            scale: 8,
            isNullable: true,
          },
          { name: 'network_settings', type: 'jsonb', isNullable: true },
          { name: 'supports_eip1559', type: 'boolean', default: false },
          { name: 'supports_flashbots', type: 'boolean', default: false },
          { name: 'supports_erc20', type: 'boolean', default: true },
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

    await queryRunner.createIndex(
      'network_configs',
      new TableIndex({
        name: 'IDX_network_configs_network',
        columnNames: ['network'],
      }),
    );

    await queryRunner.createIndex(
      'network_configs',
      new TableIndex({
        name: 'IDX_network_configs_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'network_configs',
      new TableIndex({
        name: 'IDX_network_configs_is_active',
        columnNames: ['is_active'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'network_configs',
      'IDX_network_configs_is_active',
    );
    await queryRunner.dropIndex(
      'network_configs',
      'IDX_network_configs_status',
    );
    await queryRunner.dropIndex(
      'network_configs',
      'IDX_network_configs_network',
    );
    await queryRunner.dropTable('network_configs', true);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."network_status_enum"`,
    );
  }
}
