import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import * as path from 'path';

config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
config({ path: '.env' }); // fallback to .env if env-specific file doesn't exist

const isProduction = process.env.NODE_ENV === 'production';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD ? String(process.env.DB_PASSWORD).trim() : undefined,
  database: process.env.DB_NAME || 'dabdub_dev',
  entities: isProduction
    ? [path.join(__dirname, 'dist/**/*.entity.js')]
    : ['src/**/*.entity.ts'],
  migrations: isProduction
    ? [path.join(__dirname, 'dist/database/migrations/*.js')]
    : ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: !isProduction,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});
