import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MerchantGuard } from '../src/auth/guards/merchant.guard';
import { ExchangeRateService } from '../src/exchange-rate/exchange-rate.service';

describe('POST /api/v1/payments (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(MerchantGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(ExchangeRateService)
      .useValue({
        getFiatToUsdRate: jest.fn().mockResolvedValue(1),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('accepts amount, currency, chain and returns paymentId, depositAddress, usdcAmount, qrPayload, expiresAt', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Content-Type', 'application/json')
      .send({
        amount: 50,
        currency: 'USD',
        chain: 'polygon',
      })
      .expect(201);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    const d = res.body.data;
    expect(d).toHaveProperty('paymentId');
    expect(d).toHaveProperty('depositAddress');
    expect(typeof d.depositAddress).toBe('string');
    expect(d).toHaveProperty('usdcAmount', 50);
    expect(d).toHaveProperty('qrPayload');
    expect(d).toHaveProperty('expiresAt');

    const qr = JSON.parse(d.qrPayload);
    expect(qr).toMatchObject({ token: 'USDC', chain: 'polygon' });
    expect(new Date(d.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('validates chain against supported chains', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Content-Type', 'application/json')
      .send({
        amount: 10,
        currency: 'USD',
        chain: 'invalid-chain',
      })
      .expect(400);
  });

  it('honors Idempotency-Key header and returns same payment on duplicate', async () => {
    const idemKey = `e2e-idem-${Date.now()}`;
    const payload = {
      amount: 25,
      currency: 'USD',
      chain: 'polygon',
    };

    const res1 = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', idemKey)
      .send(payload)
      .expect(201);

    const res2 = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Content-Type', 'application/json')
      .set('Idempotency-Key', idemKey)
      .send(payload)
      .expect(201);

    expect(res1.body.data.paymentId).toBe(res2.body.data.paymentId);
    expect(res1.body.data.depositAddress).toBe(res2.body.data.depositAddress);
  });

  it('accepts optional metadata and expiresInMinutes', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Content-Type', 'application/json')
      .send({
        amount: 10,
        currency: 'USD',
        chain: 'base',
        metadata: { orderId: 'ord-123' },
        expiresInMinutes: 60,
      })
      .expect(201);

    expect(res.body.data.paymentId).toBeDefined();
    const expiresAt = new Date(res.body.data.expiresAt).getTime();
    const inAboutAnHour = Date.now() + 59 * 60 * 1000;
    expect(expiresAt).toBeGreaterThanOrEqual(inAboutAnHour - 60000);
  });
});
