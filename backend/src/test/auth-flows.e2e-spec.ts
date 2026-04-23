import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { Connection } from 'typeorm';
import request from 'supertest';
import { AuthModule } from '../auth/auth.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { AppThrottlerGuard } from '../auth/guards/throttler.guard';
import { Merchant } from '../merchants/entities/merchant.entity';
import { AdminAuditLog } from '../merchants/entities/admin-audit-log.entity';

const API = '/api/v1';

function authImports(throttleDefaults: { ttl: string; limit: string }) {
  process.env.THROTTLE_DEFAULT_TTL_MS = throttleDefaults.ttl;
  process.env.THROTTLE_DEFAULT_LIMIT = throttleDefaults.limit;
  process.env.THROTTLE_AUTHENTICATED_TTL_MS = '60000';
  process.env.THROTTLE_AUTHENTICATED_LIMIT = '1000';

  return [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME_TEST ?? 'cheesepay_test',
      entities: [Merchant, AdminAuditLog],
      synchronize: true,
      logging: false,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: Number(config.get('THROTTLE_DEFAULT_TTL_MS', 60000)),
            limit: Number(config.get('THROTTLE_DEFAULT_LIMIT', 100)),
          },
          {
            name: 'authenticated',
            ttl: Number(config.get('THROTTLE_AUTHENTICATED_TTL_MS', 60000)),
            limit: Number(config.get('THROTTLE_AUTHENTICATED_LIMIT', 1000)),
          },
        ],
      }),
    }),
    AuthModule,
    MerchantsModule,
  ];
}

async function truncateMerchants(conn: Connection): Promise<void> {
  await conn.query('TRUNCATE TABLE "merchants" RESTART IDENTITY CASCADE');
}

async function createHttpApp(jwtExpiresIn: string): Promise<INestApplication> {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-jwt-secret-for-hs256-testing-only-32b';
  process.env.JWT_EXPIRES_IN = jwtExpiresIn;

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: authImports({ ttl: '60000', limit: '1000' }),
    providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
  }).compile();

  const application = moduleFixture.createNestApplication();
  application.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  application.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.ALL },
      { path: 'health/ready', method: RequestMethod.ALL },
    ],
  });
  await application.init();
  return application;
}

describe('Authentication flows (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createHttpApp('30s');
  });

  afterEach(async () => {
    const conn = app.get(Connection);
    await truncateMerchants(conn);
  });

  afterAll(async () => {
    await app.close();
  });

  it('register → login → access protected route → 200', async () => {
    const email = `merchant-${Date.now()}@example.com`;
    const password = 'SecurePass123!';

    await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({
        email,
        password,
        businessName: 'E2E Shop',
      })
      .expect(201);

    const login = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password })
      .expect(200);

    const token = login.body.accessToken as string;
    expect(token).toBeDefined();

    const me = await request(app.getHttpServer())
      .get(`${API}/merchants/me`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(me.body.email).toBe(email);
  });

  it('wrong password → 401', async () => {
    const email = `badlogin-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({ email, password: 'SecurePass123!', businessName: 'B' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password: 'WrongPassword999!' })
      .expect(401);
  });

  it('valid API key → 200 on protected route', async () => {
    const email = `apikey-${Date.now()}@example.com`;
    const reg = await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({ email, password: 'SecurePass123!', businessName: 'KeyCo' })
      .expect(201);

    const jwt = reg.body.accessToken as string;
    const keyRes = await request(app.getHttpServer())
      .post(`${API}/merchants/api-keys`)
      .set('Authorization', `Bearer ${jwt}`)
      .expect(201);

    const apiKey = keyRes.body.apiKey as string;
    expect(apiKey).toMatch(/^cpk_/);

    const me = await request(app.getHttpServer()).get(`${API}/merchants/me`).set('X-API-Key', apiKey).expect(200);

    expect(me.body.email).toBe(email);
  });
});

describe('Authentication flows — rate limit (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-jwt-secret-for-hs256-testing-only-32b';
    process.env.JWT_EXPIRES_IN = '30s';
    process.env.THROTTLE_DEFAULT_TTL_MS = '30000';
    process.env.THROTTLE_DEFAULT_LIMIT = '2';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: authImports({ ttl: '30000', limit: '2' }),
      providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/ready', method: RequestMethod.ALL },
      ],
    });
    await app.init();
  });

  afterEach(async () => {
    const conn = app.get(Connection);
    await truncateMerchants(conn);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.THROTTLE_DEFAULT_TTL_MS;
    delete process.env.THROTTLE_DEFAULT_LIMIT;
  });

  it('rate limit exceeded → 429 (short TTL / low limit via env)', async () => {
    const email = `ratelimit-${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({ email, password: 'SecurePass123!', businessName: 'RL' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password: 'WrongOne!!!' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password: 'WrongTwo!!!' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email, password: 'WrongThree!!!' })
      .expect(429);
  });
});

describe('Authentication flows — JWT expiry (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e-jwt-secret-for-hs256-testing-only-32b';
    process.env.JWT_EXPIRES_IN = '4s';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: authImports({ ttl: '60000', limit: '1000' }),
      providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/ready', method: RequestMethod.ALL },
      ],
    });
    await app.init();
  });

  afterEach(async () => {
    jest.useRealTimers();
    const conn = app.get(Connection);
    await truncateMerchants(conn);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.JWT_EXPIRES_IN;
  });

  it('expired JWT → 401 (clock advanced)', async () => {
    const email = `expired-${Date.now()}@example.com`;
    const login = await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({ email, password: 'SecurePass123!', businessName: 'ExpCo' })
      .expect(201);

    const token = login.body.accessToken as string;

    await request(app.getHttpServer()).get(`${API}/merchants/me`).set('Authorization', `Bearer ${token}`).expect(200);

    jest.useFakeTimers({ advanceTimers: true });
    jest.setSystemTime(Date.now() + 15_000);

    await request(app.getHttpServer()).get(`${API}/merchants/me`).set('Authorization', `Bearer ${token}`).expect(401);
  });
});
