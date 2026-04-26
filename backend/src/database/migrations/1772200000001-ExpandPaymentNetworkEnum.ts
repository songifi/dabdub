import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandPaymentNetworkEnum1772200000001 implements MigrationInterface {
  name = 'ExpandPaymentNetworkEnum1772200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."payments_network_enum"
        ADD VALUE IF NOT EXISTS 'polygon',
        ADD VALUE IF NOT EXISTS 'base',
        ADD VALUE IF NOT EXISTS 'celo',
        ADD VALUE IF NOT EXISTS 'arbitrum',
        ADD VALUE IF NOT EXISTS 'optimism',
        ADD VALUE IF NOT EXISTS 'starknet',
        ADD VALUE IF NOT EXISTS 'stacks'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values; down is a no-op
  }
}
