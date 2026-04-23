/**
 * Runs before any e2e spec module is loaded so ConfigModule sees stable test defaults.
 * Override via real environment variables or backend/.env when running locally.
 */
process.env.JWT_SECRET ??= 'e2e-jwt-secret-do-not-use-in-prod';
process.env.API_PREFIX ??= 'api/v1';
/** Shorter than prod, but long enough that slow sequential HTTP logins stay in one window */
process.env.THROTTLE_AUTH_TTL_MS ??= '8000';
process.env.THROTTLE_AUTH_LIMIT ??= '4';
process.env.DB_HOST ??= 'localhost';
process.env.DB_PORT ??= '5432';
process.env.DB_USER ??= 'postgres';
process.env.DB_PASSWORD ??= 'postgres';
/** Prefer the default cluster DB so CI/local runs do not require creating `cheesepay` first. */
process.env.DB_NAME ??= 'postgres';
