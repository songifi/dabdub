import 'reflect-metadata';
import * as path from 'path';
import { createConnection } from 'typeorm';

async function main(): Promise<void> {
  const password = process.env.DB_PASSWORD || process.env.DB_PASS || '';
  const connection = await createConnection({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(String(process.env.DB_PORT || '5432'), 10),
    username: process.env.DB_USER || 'postgres',
    password,
    database: process.env.DB_NAME || 'cheesepay',
    entities: [],
    migrations: [path.join(__dirname, '..', 'src', 'database', 'migrations', '*.{ts,js}')],
    migrationsTableName: 'typeorm_migrations',
  });

  const executed = await connection.runMigrations();
  for (const m of executed) {
    // eslint-disable-next-line no-console
    console.log('Applied migration:', m.name);
  }
  if (executed.length === 0) {
    // eslint-disable-next-line no-console
    console.log('No pending migrations (database is up to date).');
  }

  await connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
