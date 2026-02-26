import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class PaymentRequestFields1772600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'payments';

    await queryRunner.addColumn(
      table,
      new TableColumn({
        name: 'depositAddress',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      table,
      new TableColumn({
        name: 'usdcAmount',
        type: 'decimal',
        precision: 18,
        scale: 8,
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      table,
      new TableColumn({
        name: 'expiresAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      table,
      new TableColumn({
        name: 'idempotencyKey',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      table,
      new TableColumn({
        name: 'metadata',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_payments_idempotency_key" ON "payments" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'payments';

    await queryRunner.query(
      'DROP INDEX IF EXISTS "UQ_payments_idempotency_key"',
    );
    await queryRunner.dropColumn(table, 'metadata');
    await queryRunner.dropColumn(table, 'idempotencyKey');
    await queryRunner.dropColumn(table, 'expiresAt');
    await queryRunner.dropColumn(table, 'usdcAmount');
    await queryRunner.dropColumn(table, 'depositAddress');
  }
}
