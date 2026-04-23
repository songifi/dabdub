import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import request = require('supertest');

function decodeJwtPayload(token: string): { exp?: number } {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: number };
  } catch {
    return {};
  }
}

describe('Auth flows (e2e)', () => {
  let app: INestApplication | undefined;
  let server: ReturnType<INestApplication['getHttpServer']>;
  const prefix = '/api/v1';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    if (app) {
      await app.close();
    }
  });

  it('Register → login → access protected route → 200', async () => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = 'TestPassw0rd!';

    await request(server)
      .post(`${prefix}/auth/register`)
      .send({ email, password, businessName: 'E2E Merchant' })
      .expect(201);

    const loginRes = await request(server)
      .post(`${prefix}/auth/login`)
      .send({ email, password })
      .expect(200);

    expect(loginRes.body.accessToken).toBeDefined();

    await request(server)
      .get(`${prefix}/merchants/me`)
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(200);
  });

  it('Wrong password → 401', async () => {
    const email = `e2e-wp-${Date.now()}@example.com`;
    const password = 'TestPassw0rd!';

    await request(server)
      .post(`${prefix}/auth/register`)
      .send({ email, password, businessName: 'E2E Merchant' })
      .expect(201);

    await request(server)
      .post(`${prefix}/auth/login`)
      .send({ email, password: 'WrongPassw0rd!' })
      .expect(401);
  });

  it('Expired JWT → 401 (clock moved past exp)', async () => {
    const email = `e2e-exp-${Date.now()}@example.com`;
    const password = 'TestPassw0rd!';

    await request(server)
      .post(`${prefix}/auth/register`)
      .send({ email, password, businessName: 'E2E Merchant' })
      .expect(201);

    const loginRes = await request(server)
      .post(`${prefix}/auth/login`)
      .send({ email, password })
      .expect(200);

    const token = loginRes.body.accessToken as string;
    const { exp } = decodeJwtPayload(token);
    expect(exp).toBeDefined();

    const pastExpMs = ((exp as number) + 5) * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(pastExpMs);

    await request(server)
      .get(`${prefix}/merchants/me`)
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    jest.spyOn(Date, 'now').mockRestore();
  });

  it('Valid API key → 200 on protected route', async () => {
    const email = `e2e-key-${Date.now()}@example.com`;
    const password = 'TestPassw0rd!';

    await request(server)
      .post(`${prefix}/auth/register`)
      .send({ email, password, businessName: 'E2E Merchant' })
      .expect(201);

    const loginRes = await request(server)
      .post(`${prefix}/auth/login`)
      .send({ email, password })
      .expect(200);

    const keyRes = await request(server)
      .post(`${prefix}/merchants/api-keys`)
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(201);

    const apiKey = keyRes.body.apiKey as string;
    expect(apiKey).toMatch(/^cpk_/);

    await request(server).get(`${prefix}/merchants/me`).set('X-API-Key', apiKey).expect(200);
  });

  it('Rate limit exceeded → 429 on login (short TTL from env)', async () => {
    const email = `e2e-rl-${Date.now()}@example.com`;
    const password = 'TestPassw0rd!';

    await request(server)
      .post(`${prefix}/auth/register`)
      .send({ email, password, businessName: 'E2E Merchant' })
      .expect(201);

    const limit = parseInt(process.env.THROTTLE_AUTH_LIMIT || '4', 10);
    for (let i = 0; i < limit; i++) {
      await request(server)
        .post(`${prefix}/auth/login`)
        .send({ email, password: 'WrongPassw0rd!' })
        .expect(401);
    }

    await request(server)
      .post(`${prefix}/auth/login`)
      .send({ email, password: 'WrongPassw0rd!' })
      .expect(429);
  });
});
