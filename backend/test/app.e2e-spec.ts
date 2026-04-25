import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { ExecutionContext } from '@nestjs/common';

import { AuthModule } from '../src/auth/auth.module';
import { PayLinkModule } from '../src/paylink/paylink.module';
import { AuthService } from '../src/auth/auth.service';
import { PayLinkService } from '../src/paylink/paylink.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { User } from '../src/users/entities/user.entity';
import { Admin } from '../src/admin/entities/admin.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { Session } from '../src/auth/entities/session.entity';
import { PayLink, PayLinkStatus } from '../src/paylink/entities/pay-link.entity';
import { CacheService } from '../src/cache/cache.service';
import { SorobanService } from '../src/soroban/soroban.service';
import { CheeseGateway } from '../src/ws/cheese.gateway';
import { EmailService } from '../src/email/email.service';
import { NotificationService } from '../src/notifications/notifications.service';
import { BalanceService } from '../src/balance/balance.service';
import { PayLinkProcessor } from '../src/paylink/paylink.processor';
import { getQueueToken } from '@nestjs/bull';
import { PAYLINK_QUEUE } from '../src/paylink/paylink.processor';

// ── Shared fixtures ──────────────────────────────────────────────────────────

const MOCK_USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const mockTokenResponse = {
  accessToken: 'mock.access.token',
  refreshToken: 'mock.refresh.token',
  expiresIn: 900,
};

const mockPayLink: PayLink = {
  id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
  creatorUserId: MOCK_USER_ID,
  tokenId: 'inv-2026-001',
  amount: '25.50',
  note: 'Invoice #1',
  status: PayLinkStatus.ACTIVE,
  paidByUserId: null,
  expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
  createdTxHash: 'txhash123',
  paymentTxHash: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
} as PayLink;

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildAuthApp(module: TestingModule): INestApplication<App> {
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  return app;
}

function buildPayApp(module: TestingModule): INestApplication<App> {
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  return app;
}

async function createAuthModule(): Promise<TestingModule> {
  return Test.createTestingModule({ imports: [AuthModule] })
    .overrideProvider(getRepositoryToken(User)).useValue({})
    .overrideProvider(getRepositoryToken(Admin)).useValue({})
    .overrideProvider(getRepositoryToken(RefreshToken)).useValue({})
    .overrideProvider(getRepositoryToken(Session)).useValue({})
    .overrideProvider(CacheService).useValue({ trackActiveUser: jest.fn() })
    .overrideProvider(AuthService).useValue({
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    })
    .compile();
}

async function createPayLinkModule(): Promise<TestingModule> {
  return Test.createTestingModule({ imports: [PayLinkModule] })
    .overrideProvider(getRepositoryToken(PayLink)).useValue({})
    .overrideProvider(getRepositoryToken(User)).useValue({})
    .overrideProvider(getRepositoryToken('Merchant')).useValue({})
    .overrideProvider(getRepositoryToken('Transaction')).useValue({})
    .overrideProvider(PayLinkService).useValue({
      create: jest.fn(),
      getPublic: jest.fn(),
      pay: jest.fn(),
      cancel: jest.fn(),
      list: jest.fn(),
    })
    .overrideProvider(SorobanService).useValue({})
    .overrideProvider(CheeseGateway).useValue({})
    .overrideProvider(EmailService).useValue({})
    .overrideProvider(NotificationService).useValue({})
    .overrideProvider(BalanceService).useValue({})
    .overrideProvider(PayLinkProcessor).useValue({})
    .overrideProvider(getQueueToken(PAYLINK_QUEUE)).useValue({ add: jest.fn() })
    .overrideGuard(JwtAuthGuard).useValue({
      canActivate: (ctx: ExecutionContext) => {
        const req = ctx.switchToHttp().getRequest();
        req.user = { id: MOCK_USER_ID } as User;
        return true;
      },
    })
    .compile();
}

// ── Auth E2E ─────────────────────────────────────────────────────────────────

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let authService: jest.Mocked<AuthService>;

  beforeAll(async () => {
    const module = await createAuthModule();
    app = buildAuthApp(module);
    await app.init();
    authService = module.get(AuthService);
  });

  afterAll(() => app.close());

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and returns tokens (201)', async () => {
      authService.register.mockResolvedValue(mockTokenResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'alice@example.com', username: 'alice99', password: 'supersecret123' })
        .expect(201);

      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
      });
    });

    it('returns 400 for missing fields', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'bad@example.com' })
        .expect(400);
    });

    it('returns 400 for invalid email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', username: 'alice99', password: 'supersecret123' })
        .expect(400);
    });

    it('returns 400 for password too short', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'alice@example.com', username: 'alice99', password: 'short' })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in and returns tokens (200)', async () => {
      authService.login.mockResolvedValue(mockTokenResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'alice@example.com', password: 'supersecret123' })
        .expect(200);

      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
      });
    });

    it('returns 400 for missing password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'alice@example.com' })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('refreshes tokens (200)', async () => {
      authService.refresh.mockResolvedValue(mockTokenResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'mock.refresh.token' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
    });
  });
});

// ── PayLink E2E ──────────────────────────────────────────────────────────────

describe('PayLink (e2e)', () => {
  let app: INestApplication<App>;
  let payLinkService: jest.Mocked<PayLinkService>;

  beforeAll(async () => {
    const module = await createPayLinkModule();
    app = buildPayApp(module);
    await app.init();
    payLinkService = module.get(PayLinkService);
  });

  afterAll(() => app.close());

  describe('POST /api/v1/paylinks', () => {
    it('creates a paylink and returns 201', async () => {
      payLinkService.create.mockResolvedValue(mockPayLink);

      const res = await request(app.getHttpServer())
        .post('/api/v1/paylinks')
        .set('Authorization', 'Bearer mock.access.token')
        .send({ amount: '25.50', note: 'Invoice #1', customSlug: 'inv-2026-001' })
        .expect(201);

      expect(res.body).toMatchObject({
        tokenId: 'inv-2026-001',
        amount: '25.50',
        status: PayLinkStatus.ACTIVE,
      });
    });

    it('returns 400 for missing amount', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/paylinks')
        .set('Authorization', 'Bearer mock.access.token')
        .send({ note: 'No amount here' })
        .expect(400);
    });

    it('returns 400 for invalid customSlug', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/paylinks')
        .set('Authorization', 'Bearer mock.access.token')
        .send({ amount: '10.00', customSlug: 'x' }) // too short (< 4 chars)
        .expect(400);
    });
  });

  describe('GET /api/v1/paylinks/:tokenId', () => {
    it('returns public paylink details (200)', async () => {
      payLinkService.getPublic.mockResolvedValue({
        creatorDisplayName: 'Alice',
        businessName: null,
        amount: '25.50',
        note: 'Invoice #1',
        status: PayLinkStatus.ACTIVE,
        expiresAt: mockPayLink.expiresAt,
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/paylinks/inv-2026-001')
        .expect(200);

      expect(res.body).toMatchObject({
        amount: '25.50',
        status: PayLinkStatus.ACTIVE,
      });
    });
  });
});

// ── Auth → PayLink flow (e2e) ────────────────────────────────────────────────

describe('Auth → PayLink flow (e2e)', () => {
  let authApp: INestApplication<App>;
  let payApp: INestApplication<App>;
  let authService: jest.Mocked<AuthService>;
  let payLinkService: jest.Mocked<PayLinkService>;

  beforeAll(async () => {
    const [authModule, payModule] = await Promise.all([
      createAuthModule(),
      createPayLinkModule(),
    ]);

    authApp = buildAuthApp(authModule);
    payApp = buildPayApp(payModule);
    await Promise.all([authApp.init(), payApp.init()]);

    authService = authModule.get(AuthService);
    payLinkService = payModule.get(PayLinkService);
  });

  afterAll(() => Promise.all([authApp.close(), payApp.close()]));

  it('register → login → create paylink → check status', async () => {
    // 1. Register
    authService.register.mockResolvedValue(mockTokenResponse);
    const registerRes = await request(authApp.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'bob@example.com', username: 'bob42', password: 'password123' })
      .expect(201);

    const { accessToken } = registerRes.body as typeof mockTokenResponse;
    expect(accessToken).toBeDefined();

    // 2. Login
    authService.login.mockResolvedValue(mockTokenResponse);
    const loginRes = await request(authApp.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'bob@example.com', password: 'password123' })
      .expect(200);

    expect(loginRes.body.accessToken).toBeDefined();

    // 3. Create paylink (authenticated)
    payLinkService.create.mockResolvedValue(mockPayLink);
    const createRes = await request(payApp.getHttpServer())
      .post('/api/v1/paylinks')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ amount: '25.50', note: 'Invoice #1', customSlug: 'inv-2026-001' })
      .expect(201);

    const { tokenId } = createRes.body as { tokenId: string };
    expect(tokenId).toBe('inv-2026-001');

    // 4. Check paylink status (public endpoint — no auth needed)
    payLinkService.getPublic.mockResolvedValue({
      creatorDisplayName: 'Bob',
      businessName: null,
      amount: '25.50',
      note: 'Invoice #1',
      status: PayLinkStatus.ACTIVE,
      expiresAt: mockPayLink.expiresAt,
    });

    const statusRes = await request(payApp.getHttpServer())
      .get(`/api/v1/paylinks/${tokenId}`)
      .expect(200);

    expect(statusRes.body.status).toBe(PayLinkStatus.ACTIVE);
    expect(statusRes.body.amount).toBe('25.50');
  });
});
