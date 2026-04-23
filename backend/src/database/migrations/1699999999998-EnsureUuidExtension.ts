import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureUuidExtension1699999999998 implements MigrationInterface {
  name = 'EnsureUuidExtension1699999999998';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
  }
}
