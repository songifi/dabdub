import { registerAs } from '@nestjs/config';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  name: string;
}

export const databaseConfig = registerAs(
  'database',
  (): DatabaseConfig => ({
    host: process.env['DB_HOST']!,
    port: parseInt(process.env['DB_PORT']!, 10),
    user: process.env['DB_USER']!,
    pass: process.env['DB_PASS']!,
    name: process.env['DB_NAME']!,
  }),
);
