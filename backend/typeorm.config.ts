import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import * as path from 'path';

// Load env from backend directory (where this config lives)
const root = path.resolve(__dirname);
config({ path: path.join(root, `.env.${process.env.NODE_ENV || 'development'}`) });
config({ path: path.join(root, '.env') });

const isProduction = process.env.NODE_ENV === 'production';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD ? String(process.env.DB_PASSWORD).trim() : undefined,
  database: process.env.DB_NAME || 'dabdub_dev',
  entities: isProduction
    ? [path.join(root, 'dist', '**', '*.entity.js')]
    : [path.join(root, 'src', '**', '*.entity.ts')],
  migrations: isProduction
    ? [path.join(root, 'dist', 'database', 'migrations', '*.js')]
    : [path.join(root, 'src', 'database', 'migrations', '*.ts')],
  synchronize: false,
  logging: !isProduction,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});
