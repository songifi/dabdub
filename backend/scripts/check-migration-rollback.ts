import { AppDataSource } from '../src/database/data-source';

type MigrationRow = { id: number; timestamp: number; name: string };

async function getAppliedMigrationCount(): Promise<number> {
  const rows = await AppDataSource.query('SELECT * FROM "migrations"');
  return (rows as MigrationRow[]).length;
}

async function revertAllMigrations(): Promise<void> {
  while ((await getAppliedMigrationCount()) > 0) {
    await AppDataSource.undoLastMigration();
  }
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    await AppDataSource.query("SET lock_timeout = '5s'");

    await AppDataSource.runMigrations();
    const afterUp = await getAppliedMigrationCount();
    if (afterUp === 0) {
      throw new Error('Expected at least one migration to be applied in up phase');
    }

    await revertAllMigrations();
    const afterDown = await getAppliedMigrationCount();
    if (afterDown !== 0) {
      throw new Error('Expected zero applied migrations after full rollback');
    }

    await AppDataSource.runMigrations();
    const afterSecondUp = await getAppliedMigrationCount();
    if (afterSecondUp !== afterUp) {
      throw new Error(
        `Expected second up migration count (${afterSecondUp}) to match first up count (${afterUp})`,
      );
    }

    console.log('Migration rollback check passed (up -> down -> up).');
  } finally {
    await AppDataSource.destroy();
  }
}

void main();
