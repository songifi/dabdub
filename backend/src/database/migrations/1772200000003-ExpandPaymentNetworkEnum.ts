import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandPaymentNetworkEnum1772200000003 implements MigrationInterface {
  name = 'ExpandPaymentNetworkEnum1772200000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const enumExistsResult = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'payments_network_enum'
          AND n.nspname = 'public'
      ) AS "exists"
    `);

    const enumExists = Boolean(enumExistsResult?.[0]?.exists);
    if (!enumExists) {
      return;
    }

    const values = [
      'polygon',
      'base',
      'celo',
      'arbitrum',
      'optimism',
      'starknet',
      'stacks',
    ];

    for (const value of values) {
      await queryRunner.query(
        `ALTER TYPE "public"."payments_network_enum" ADD VALUE IF NOT EXISTS '${value}'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values; down is a no-op
  }
}
