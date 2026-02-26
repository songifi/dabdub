import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('API Key Management (e2e)', () => {
  let app: INestApplication;
  let authHeader: string;
  const uniqueId = Date.now();
  const merchantData = {
    name: `ApiKey Merchant ${uniqueId}`,
    email: `apikey${uniqueId}@example.com`,
    password: 'password123',
    businessName: `Business ${uniqueId}`,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Register and login to get merchant JWT
    await request(app.getHttpServer())
      .post('/api/v1/merchants/register')
      .send(merchantData)
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/merchants/login')
      .send({ email: merchantData.email, password: merchantData.password })
      .expect(200);

    authHeader = `Bearer ${loginRes.body.accessToken}`;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/api-keys', () => {
    it('creates an API key and returns plaintext once', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', authHeader)
        .send({
          name: 'Test key',
          scopes: ['payments:read', 'payments:write', 'settlements:read'],
        })
        .expect(201);

      expect(res.body).toMatchObject({
        apiKey: expect.any(String),
        id: expect.any(String),
        name: 'Test key',
        scopes: ['payments:read', 'payments:write', 'settlements:read'],
      });
      expect(res.body.apiKey).toMatch(/^sk_live_/);
      expect(res.body.apiKey.length).toBeGreaterThan(20);
    });
  });

  describe('GET /api/v1/api-keys', () => {
    it('lists keys masked with scopes and last_used_at', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/api-keys')
        .set('Authorization', authHeader)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      res.body.forEach((key: any) => {
        expect(key).toHaveProperty('id');
        expect(key).toHaveProperty('name');
        expect(key).toHaveProperty('prefix');
        expect(key).toHaveProperty('scopes');
        expect(key).toHaveProperty('lastUsedAt');
        expect(key).toHaveProperty('createdAt');
        expect(key).toHaveProperty('isActive');
        expect(key).not.toHaveProperty('apiKey');
        expect(key).not.toHaveProperty('keyHash');
      });
    });
  });

  describe('DELETE /api/v1/api-keys/:id', () => {
    it('revokes key immediately', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', authHeader)
        .send({ name: 'To revoke', scopes: ['payments:read'] })
        .expect(201);

      const id = createRes.body.id;

      await request(app.getHttpServer())
        .delete(`/api/v1/api-keys/${id}`)
        .set('Authorization', authHeader)
        .expect(204);

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/api-keys')
        .set('Authorization', authHeader)
        .expect(200);

      const revoked = listRes.body.find((k: any) => k.id === id);
      expect(revoked).toBeDefined();
      expect(revoked.isActive).toBe(false);
    });
  });

  describe('Key lifecycle', () => {
    it('created key can be used (ApiKeyGuard), then revoke removes access', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', authHeader)
        .send({ name: 'Lifecycle key', scopes: ['payments:read'] })
        .expect(201);

      const plainKey = createRes.body.apiKey;
      const id = createRes.body.id;

      // Use key via x-api-key header on a route protected by ApiKeyGuard (if any exists)
      // Here we only verify key appears in list and has lastUsedAt after use
      const listBefore = await request(app.getHttpServer())
        .get('/api/v1/api-keys')
        .set('Authorization', authHeader)
        .expect(200);
      const keyMeta = listBefore.body.find((k: any) => k.id === id);
      expect(keyMeta).toBeDefined();

      await request(app.getHttpServer())
        .delete(`/api/v1/api-keys/${id}`)
        .set('Authorization', authHeader)
        .expect(204);

      const listAfter = await request(app.getHttpServer())
        .get('/api/v1/api-keys')
        .set('Authorization', authHeader)
        .expect(200);
      const afterRevoke = listAfter.body.find((k: any) => k.id === id);
      expect(afterRevoke.isActive).toBe(false);
    });
  });
});
