import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandPaymentNetworkEnum1772200000001 implements MigrationInterface {
  name = 'ExpandPaymentNetworkEnum1772200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL allows only one ADD VALUE per ALTER TYPE statement.
    const networks = [
      'polygon',
      'base',
      'celo',
      'arbitrum',
      'optimism',
      'starknet',
      'stacks',
    ] as const;
    for (const network of networks) {
      await queryRunner.query(
        `ALTER TYPE "public"."payments_network_enum" ADD VALUE IF NOT EXISTS '${network}'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values; down is a no-op
  }
}
