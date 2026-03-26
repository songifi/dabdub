/**
 * TypeORM CLI data-source — used by migration:generate / migration:run / migration:revert.
 *
 * Runs OUTSIDE the NestJS DI context, so dotenv is loaded manually.
 * process.env access is deliberately isolated to this file only.
 *
 * Usage:
 *   pnpm migration:generate src/database/migrations/CreateUsers
 *   pnpm migration:run
 *   pnpm migration:revert
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

dotenv.config();

const { DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME } = process.env as Record<
  string,
  string
>;

if (!DB_HOST || !DB_USER || !DB_PASS || !DB_NAME) {
  throw new Error(
    '[data-source] Missing required env vars: DB_HOST, DB_USER, DB_PASS, DB_NAME\n' +
      'Ensure your .env file is present and populated before running TypeORM CLI commands.',
  );
}

/**
 * AppDataSource is the shared DataSource instance for:
 *   - TypeORM CLI (migration:generate / run / revert)
 *   - The standalone seed script (src/database/seed.ts)
 *
 * Entity globs cover both ts-node (src) and compiled (dist) paths so the same
 * data-source works in both dev and CI environments.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: DB_HOST,
  port: parseInt(DB_PORT ?? '5432', 10),
  username: DB_USER,
  password: DB_PASS,
  database: DB_NAME,

  // ts-node path used by migration:generate; dist path used by migration:run in CI.
  entities: [
    `${__dirname}/../**/*.entity.ts`,
    `${__dirname}/../**/*.entity.js`,
  ],
  migrations: [`${__dirname}/migrations/*.ts`, `${__dirname}/migrations/*.js`],

  synchronize: false,
  logging: ['error', 'warn'],
});
