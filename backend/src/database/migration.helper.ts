import type { QueryRunner } from 'typeorm';

export class MigrationHelper {
  static async addColumnIfNotExists(
    runner: QueryRunner,
    table: string,
    column: string,
    definition: string,
  ): Promise<void> {
    await runner.query(
      `ALTER TABLE ${MigrationHelper.quoteIdent(table)} ADD COLUMN IF NOT EXISTS ${MigrationHelper.quoteIdent(column)} ${definition}`,
    );
  }

  static async dropColumnIfExists(
    runner: QueryRunner,
    table: string,
    column: string,
  ): Promise<void> {
    await runner.query(
      `ALTER TABLE ${MigrationHelper.quoteIdent(table)} DROP COLUMN IF EXISTS ${MigrationHelper.quoteIdent(column)}`,
    );
  }

  static async createIndexConcurrently(
    runner: QueryRunner,
    name: string,
    table: string,
    columns: string[],
    isUnique = false,
  ): Promise<void> {
    const cols = columns.map((c) => MigrationHelper.quoteIdent(c)).join(', ');
    const unique = isUnique ? 'UNIQUE ' : '';
    await runner.query(
      `CREATE ${unique}INDEX CONCURRENTLY IF NOT EXISTS ${MigrationHelper.quoteIdent(name)} ON ${MigrationHelper.quoteIdent(table)} (${cols})`,
    );
  }

  private static quoteIdent(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }
}
