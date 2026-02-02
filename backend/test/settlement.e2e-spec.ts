import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { SettlementRepository } from './../src/settlement/repositories/settlement.repository';
import {
  SettlementStatus,
  SettlementProvider,
} from './../src/settlement/entities/settlement.entity';
import { randomUUID } from 'crypto';

describe('SettlementController (e2e)', () => {
  let app: INestApplication;
  let authHeader: { Authorization: string };
  let settlementRepository: SettlementRepository;
  let merchantId: string;

  // Unique data for this test run
  const uniqueId = Date.now();
  const merchantData = {
    name: `Test Merchant ${uniqueId}`,
    email: `merchant.settle${uniqueId}@example.com`,
    password: 'password123',
    businessName: `Business ${uniqueId}`,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    settlementRepository =
      moduleFixture.get<SettlementRepository>(SettlementRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  it('Generic Setup: Register and Login', async () => {
    // Register
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/merchants/register')
      .send(merchantData)
      .expect(201);

    merchantId = regRes.body.id;

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/merchants/login')
      .send({
        email: merchantData.email,
        password: merchantData.password,
      })
      .expect(200);

    authHeader = { Authorization: `Bearer ${loginRes.body.accessToken}` };
  });

  it('Setup: Seed Settlement Data', async () => {
    // Create a pending settlement
    await settlementRepository.create({
      id: randomUUID(),
      paymentRequestId: randomUUID(),
      merchantId: merchantId,
      amount: 1000,
      currency: 'USD',
      sourceCurrency: 'USD',
      status: SettlementStatus.PENDING,
      netAmount: 990,
      feeAmount: 10,
      createdAt: new Date(),
      provider: SettlementProvider.BANK_API,
    });

    // Create a completed settlement
    await settlementRepository.create({
      id: randomUUID(),
      paymentRequestId: randomUUID(),
      merchantId: merchantId,
      amount: 500,
      currency: 'USD',
      sourceCurrency: 'USD',
      status: SettlementStatus.COMPLETED,
      netAmount: 495,
      feeAmount: 5,
      settledAt: new Date(),
      settlementReceipt: `RCPT-${randomUUID()}`,
      createdAt: new Date(Date.now() - 86400000), // Yesterday
      provider: SettlementProvider.BANK_API,
    });
  });

  it('/api/v1/settlements (GET)', async () => {
    return request(app.getHttpServer())
      .get('/api/v1/settlements')
      .set(authHeader)
      .expect(200)
      .then((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.data.length).toBeGreaterThanOrEqual(2);
        expect(res.body.data.total).toBeGreaterThanOrEqual(2);
      });
  });

  it('/api/v1/settlements/pending (GET)', async () => {
    return request(app.getHttpServer())
      .get('/api/v1/settlements/pending')
      .set(authHeader)
      .expect(200)
      .then((res) => {
        expect(res.body.success).toBe(true);
        const pending = res.body.data;
        expect(Array.isArray(pending)).toBe(true);
        expect(
          pending.some((s: any) => s.status === SettlementStatus.PENDING),
        ).toBe(true);
      });
  });

  it('/api/v1/settlements/statistics (GET)', async () => {
    return request(app.getHttpServer())
      .get('/api/v1/settlements/statistics')
      .set(authHeader)
      .expect(200)
      .then((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.total).toBeGreaterThanOrEqual(2);
        expect(res.body.data.pending).toBeGreaterThanOrEqual(1);
        expect(res.body.data.completed).toBeGreaterThanOrEqual(1);
        expect(Number(res.body.data.totalAmount)).toBeGreaterThan(0);
      });
  });

  it('/api/v1/settlements/schedule (GET)', async () => {
    // Default should be daily
    return request(app.getHttpServer())
      .get('/api/v1/settlements/schedule')
      .set(authHeader)
      .expect(200)
      .then((res) => {
        expect(res.body.data.schedule).toBe('daily'); // Assuming default or if not set
      });
  });

  it('/api/v1/settlements/preferences (PUT)', async () => {
    const prefs = { schedule: 'weekly', thresholdAmount: 5000 };
    return request(app.getHttpServer())
      .put('/api/v1/settlements/preferences')
      .set(authHeader)
      .send(prefs)
      .expect(200)
      .then((res) => {
        expect(res.body.data.schedule).toBe('weekly');
      });
  });

  it('/api/v1/settlements/history (GET)', async () => {
    return request(app.getHttpServer())
      .get('/api/v1/settlements/history')
      .set(authHeader)
      .query({ status: SettlementStatus.COMPLETED })
      .expect(200)
      .then((res) => {
        expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data.data[0].status).toBe(SettlementStatus.COMPLETED);
      });
  });
});
