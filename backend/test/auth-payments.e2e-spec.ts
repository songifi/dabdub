/**
 * E2E: register → login → create payment → check payment status
 *
 * Uses mocked service layer (no real DB/Redis) so it runs in CI
 * without external dependencies.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import { PaymentsModule } from '../src/payments/payments.module';
import { PaymentsService } from '../src/payments/payments.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt.guard';
import { PaymentStatus, PaymentNetwork } from '../src/payments/entities/payment.entity';

const MOCK_MERCHANT_ID = 'merchant-uuid-e2e';
const MOCK_ACCESS_TOKEN = 'mock-access-token';

const MOCK_MERCHANT = {
  id: MOCK_MERCHANT_ID,
  email: 'e2e@example.com',
  businessName: 'E2E Corp',
  role: 'merchant',
};

const MOCK_PAYMENT = {
  id: 'payment-uuid-e2e',
  merchantId: MOCK_MERCHANT_ID,
  reference: 'E2E-REF-001',
  amountUsd: 50.0,
  network: PaymentNetwork.STELLAR,
  status: PaymentStatus.PENDING,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const mockJwtGuard = {
  canActivate: (ctx: any) => {
    const req = ctx.switchToHttp().getRequest();
    req.user = { merchantId: MOCK_MERCHANT_ID, email: MOCK_MERCHANT.email, role: MOCK_MERCHANT.role };
    return true;
  },
};

describe('Auth + Payments E2E', () => {
  let app: INestApplication;
  let authService: jest.Mocked<Partial<AuthService>>;
  let paymentsService: jest.Mocked<Partial<PaymentsService>>;

  beforeAll(async () => {
    authService = {
      register: jest.fn().mockResolvedValue({ accessToken: MOCK_ACCESS_TOKEN, merchant: MOCK_MERCHANT }),
      login: jest.fn().mockResolvedValue({ accessToken: MOCK_ACCESS_TOKEN, merchant: MOCK_MERCHANT }),
    };

    paymentsService = {
      createPayment: jest.fn().mockResolvedValue(MOCK_PAYMENT),
      findOne: jest.fn().mockResolvedValue(MOCK_PAYMENT),
      findAll: jest.fn().mockResolvedValue({ items: [MOCK_PAYMENT], total: 1 }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule, PaymentsModule],
    })
      .overrideProvider(AuthService)
      .useValue(authService)
      .overrideProvider(PaymentsService)
      .useValue(paymentsService)
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('returns access token on successful registration', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'e2e@example.com', password: 'Pass1234!', businessName: 'E2E Corp' })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
    });
  });

  describe('POST /auth/login', () => {
    it('returns access token on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'e2e@example.com', password: 'Pass1234!' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
    });
  });

  describe('POST /payments', () => {
    it('creates a payment and returns pending status', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${MOCK_ACCESS_TOKEN}`)
        .send({ amountUsd: 50.0, network: PaymentNetwork.STELLAR, description: 'E2E test' })
        .expect(201);

      expect(res.body.status).toBe(PaymentStatus.PENDING);
      expect(res.body.merchantId).toBe(MOCK_MERCHANT_ID);
    });
  });

  describe('GET /payments/:id', () => {
    it('returns payment detail by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/payments/${MOCK_PAYMENT.id}`)
        .set('Authorization', `Bearer ${MOCK_ACCESS_TOKEN}`)
        .expect(200);

      expect(res.body.id).toBe(MOCK_PAYMENT.id);
      expect(res.body.status).toBe(PaymentStatus.PENDING);
    });
  });
});
