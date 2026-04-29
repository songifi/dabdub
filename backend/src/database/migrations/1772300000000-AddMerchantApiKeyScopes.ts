import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMerchantApiKeyScopes1772300000000 implements MigrationInterface {
  name = 'AddMerchantApiKeyScopes1772300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "merchants" ADD COLUMN "api_key_scopes" text NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "merchants" DROP COLUMN "api_key_scopes"`);
  }
}
