import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  poolMin: number;
  poolMax: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
}

export const databaseConfig = registerAs('database', (): DatabaseConfig => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'cheesepay',
  poolMin: parseInt(process.env.DB_POOL_MIN ?? '2', 10),
  poolMax: parseInt(process.env.DB_POOL_MAX ?? '20', 10),
  acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT_MS ?? '10000', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? '60000', 10),
}));
