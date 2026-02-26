import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';

const root = path.resolve(__dirname, '..', '..'); // backend root when run from backend/
const migrationsDir = path.join(root, 'src', 'database', 'migrations');

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD
    ? String(process.env.DB_PASSWORD).trim()
    : undefined,
  database: process.env.DB_NAME || 'dabdub_dev',
  entities: [path.join(root, 'src', '**', '*.entity.ts')],
  migrations: [path.join(migrationsDir, '*.ts')],
  synchronize: false,
  logging: true,
  logger: 'advanced-console',
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

(async () => {
  try {
    await dataSource.initialize();
    console.log('Database connection established');
    await dataSource.runMigrations();
    console.log('✓ All migrations executed successfully');
    await dataSource.destroy();
  } catch (error) {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  }
})();
