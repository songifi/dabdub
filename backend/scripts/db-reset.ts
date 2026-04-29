import 'reflect-metadata';
import * as path from 'path';
import { createConnection } from 'typeorm';
import { seedDatabase } from '../src/database/seeds';

async function main(): Promise<void> {
  const password = process.env.DB_PASSWORD || process.env.DB_PASS || '';
  const database = process.env.NODE_ENV === 'test' ? process.env.DB_NAME_TEST || 'cheesepay_test' : process.env.DB_NAME || 'cheesepay';

  const connection = await createConnection({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(String(process.env.DB_PORT || '5432'), 10),
    username: process.env.DB_USER || 'postgres',
    password,
    database,
    entities: [path.join(__dirname, '..', 'src', '**', '*.entity{.ts,.js}')],
    migrations: [path.join(__dirname, '..', 'src', 'database', 'migrations', '*.{ts,js}')],
    migrationsTableName: 'typeorm_migrations',
  });

  await connection.query('DROP SCHEMA public CASCADE');
  await connection.query('CREATE SCHEMA public');

  await connection.runMigrations();
  await seedDatabase(connection, process.env.NODE_ENV === 'test');
  await connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
