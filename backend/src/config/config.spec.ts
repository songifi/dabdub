import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from './config.module';
import type { AppConfig } from './app.config';
import type { DatabaseConfig } from './database.config';
import type { RedisConfig } from './redis.config';
import type { JwtConfig } from './jwt.config';
import type { QueueConfig } from './queue.config';

/** Minimal valid env that satisfies every required field. */
const VALID_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '3001',
  API_PREFIX: 'api',
  THROTTLE_TTL: '60',
  THROTTLE_LIMIT: '100',
  FRONTEND_URL: 'http://localhost:3000',

  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USER: 'testuser',
  DB_PASS: 'testpass',
  DB_NAME: 'testdb',

  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  BULL_BOARD_USERNAME: 'queue-admin',
  BULL_BOARD_PASSWORD: 'queue-password',

  STELLAR_NETWORK: 'testnet',
  JWT_ACCESS_SECRET: 'access-secret-that-is-at-least-32-chars!!',
  JWT_REFRESH_SECRET: 'refresh-secret-that-is-at-least-32-chars!',
  JWT_ACCESS_EXPIRY: '15m',
  JWT_REFRESH_EXPIRY: '7d',

  STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org',
  STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  STELLAR_CONTRACT_ID:
    'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
  STELLAR_ADMIN_SECRET_KEY: 'stellar-admin-secret-key-that-is-32chars!!',
  STELLAR_RECEIVE_ADDRESS: 'GBBM6BKZPEHWYOESEOTMOVALSRHVHXJ4Q2GWQYLBBZYH4M4XBRZECV2T',
  STELLAR_USDC_ISSUER: 'GBBM6BKZPEHWYOESEOTMOVALSRHVHXJ4Q2GWQYLBBZYH4M4XBRZECV2T',

  ZEPTOMAIL_API_KEY: 'zepto-api-key-value',
  ZEPTOMAIL_FROM_EMAIL: 'no-reply@example.com',

  R2_ACCOUNT_ID: 'r2-account-id',
  R2_ACCESS_KEY_ID: 'r2-access-key',
  R2_SECRET_ACCESS_KEY: 'r2-secret-key',
  R2_BUCKET_NAME: 'my-bucket',

  FLUTTERWAVE_SECRET_KEY: 'flutterwave-secret-key',
  FLUTTERWAVE_WEBHOOK_SECRET: 'flutterwave-webhook-secret',
  FLUTTERWAVE_BASE_URL: 'https://api.flutterwave.com',

  PAYSTACK_SECRET_KEY: 'paystack-secret-key',
  PAYSTACK_BASE_URL: 'https://api.paystack.co',
};

function applyEnv(overrides: NodeJS.ProcessEnv = {}): void {
  Object.assign(process.env, VALID_ENV, overrides);
}

function clearEnv(): void {
  for (const key of Object.keys(VALID_ENV)) {
    delete process.env[key];
  }
}

describe('AppConfigModule', () => {
  let config: ConfigService;

  beforeEach(async () => {
    applyEnv();

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppConfigModule],
    }).compile();

    config = module.get(ConfigService);
  });

  afterEach(() => {
    clearEnv();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('returns correct typed AppConfig values', () => {
    expect(config.get<AppConfig['port']>('app.port')).toBe(3001);
    expect(config.get<AppConfig['nodeEnv']>('app.nodeEnv')).toBe('test');
    expect(config.get<AppConfig['apiPrefix']>('app.apiPrefix')).toBe('api');
    expect(config.get<AppConfig['throttleTtl']>('app.throttleTtl')).toBe(60);
    expect(config.get<AppConfig['throttleLimit']>('app.throttleLimit')).toBe(
      100,
    );
  });

  it('returns correct typed DatabaseConfig values', () => {
    expect(config.get<DatabaseConfig['host']>('database.host')).toBe(
      'localhost',
    );
    expect(config.get<DatabaseConfig['port']>('database.port')).toBe(5432);
    expect(config.get<DatabaseConfig['user']>('database.user')).toBe(
      'testuser',
    );
    expect(config.get<DatabaseConfig['name']>('database.name')).toBe('testdb');
  });

  it('returns correct typed RedisConfig values', () => {
    expect(config.get<RedisConfig['host']>('redis.host')).toBe('localhost');
    expect(config.get<RedisConfig['port']>('redis.port')).toBe(6379);
    expect(
      config.get<RedisConfig['password']>('redis.password'),
    ).toBeUndefined();
  });

  it('returns correct typed QueueConfig values', () => {
    expect(
      config.get<QueueConfig['bullBoardUsername']>('queue.bullBoardUsername'),
    ).toBe('queue-admin');
    expect(
      config.get<QueueConfig['bullBoardPassword']>('queue.bullBoardPassword'),
    ).toBe('queue-password');
  });

  it('exposes optional REDIS_PASSWORD when provided', async () => {
    clearEnv();
    applyEnv({ REDIS_PASSWORD: 'secret' });

    const mod = await Test.createTestingModule({
      imports: [AppConfigModule],
    }).compile();

    const cs = mod.get(ConfigService);
    expect(cs.get<RedisConfig['password']>('redis.password')).toBe('secret');
  });

  it('returns correct typed JwtConfig values', () => {
    expect(config.get<JwtConfig['accessExpiry']>('jwt.accessExpiry')).toBe(
      '15m',
    );
    expect(config.get<JwtConfig['refreshExpiry']>('jwt.refreshExpiry')).toBe(
      '7d',
    );
  });

  it('returns correct Stellar, Zepto, and R2 config values', () => {
    expect(config.get<string>('stellar.network')).toBe('testnet');
    expect(config.get<string>('stellar.rpcUrl')).toBe(
      'https://soroban-testnet.stellar.org',
    );
    expect(config.get<string>('stellar.receiveAddress')).toBe(
      'GBBM6BKZPEHWYOESEOTMOVALSRHVHXJ4Q2GWQYLBBZYH4M4XBRZECV2T',
    );
    expect(config.get<string>('stellar.usdcIssuer')).toBe(
      'GBBM6BKZPEHWYOESEOTMOVALSRHVHXJ4Q2GWQYLBBZYH4M4XBRZECV2T',
    );
    expect(config.get<string>('zepto.fromEmail')).toBe('no-reply@example.com');
    expect(config.get<string>('r2.bucketName')).toBe('my-bucket');
  });

  // ── Validation failures ───────────────────────────────────────────────────

  it('throws on startup when a required variable is missing', async () => {
    clearEnv();
    applyEnv({ DB_HOST: undefined }); // missing required field

    await expect(
      Test.createTestingModule({ imports: [AppConfigModule] }).compile(),
    ).rejects.toThrow();
  });

  it('throws when JWT_ACCESS_SECRET is too short', async () => {
    clearEnv();
    applyEnv({ JWT_ACCESS_SECRET: 'tooshort' });

    await expect(
      Test.createTestingModule({ imports: [AppConfigModule] }).compile(),
    ).rejects.toThrow();
  });

  it('throws when NODE_ENV is an invalid value', async () => {
    clearEnv();
    applyEnv({ NODE_ENV: 'staging' });

    await expect(
      Test.createTestingModule({ imports: [AppConfigModule] }).compile(),
    ).rejects.toThrow();
  });

  it('throws when ZEPTOMAIL_FROM_EMAIL is not a valid email', async () => {
    clearEnv();
    applyEnv({ ZEPTOMAIL_FROM_EMAIL: 'not-an-email' });

    await expect(
      Test.createTestingModule({ imports: [AppConfigModule] }).compile(),
    ).rejects.toThrow();
  });

  it('throws when STELLAR_RPC_URL is not a valid URI', async () => {
    clearEnv();
    applyEnv({ STELLAR_RPC_URL: 'not-a-url' });

    await expect(
      Test.createTestingModule({ imports: [AppConfigModule] }).compile(),
    ).rejects.toThrow();
  });

  it('throws when STELLAR_NETWORK is invalid', async () => {
    clearEnv();
    applyEnv({ STELLAR_NETWORK: 'invalid-network' });

    await expect(
      Test.createTestingModule({ imports: [AppConfigModule] }).compile(),
    ).rejects.toThrow();
  });
});
