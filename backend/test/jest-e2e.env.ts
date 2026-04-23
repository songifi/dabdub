/**
 * Applied before e2e specs load so ConfigModule reads consistent defaults.
 * Override with real env or backend/.env for local Postgres.
 */
process.env.JWT_SECRET ??= 'e2e-jwt-secret-do-not-use-in-prod';
process.env.THROTTLE_AUTH_TTL_MS ??= '8000';
process.env.THROTTLE_AUTH_LIMIT ??= '4';
process.env.DB_HOST ??= 'localhost';
process.env.DB_PORT ??= '5432';
process.env.DB_USER ??= 'postgres';
process.env.DB_PASSWORD ??= 'postgres';
process.env.DB_NAME ??= 'postgres';
