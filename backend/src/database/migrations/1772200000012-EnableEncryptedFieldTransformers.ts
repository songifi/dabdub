import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableEncryptedFieldTransformers1772200000012
  implements MigrationInterface
{
  name = 'EnableEncryptedFieldTransformers1772200000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const walletTableExists = await queryRunner.hasTable('blockchain_wallets');
    if (walletTableExists) {
      await queryRunner.query(`
        ALTER TABLE "blockchain_wallets"
        ALTER COLUMN "iv" DROP NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const walletTableExists = await queryRunner.hasTable('blockchain_wallets');
    if (walletTableExists) {
      await queryRunner.query(`
        UPDATE "blockchain_wallets"
        SET "iv" = ''
        WHERE "iv" IS NULL
      `);
      await queryRunner.query(`
        ALTER TABLE "blockchain_wallets"
        ALTER COLUMN "iv" SET NOT NULL
      `);
    }
  }
}
