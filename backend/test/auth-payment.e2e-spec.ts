import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ExecutionContext } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthModule } from '../src/auth/auth.module';
import { TransfersModule } from '../src/transfers/transfers.module';
import { WithdrawalsModule } from '../src/withdrawals/withdrawals.module';
import { AuthService } from '../src/auth/auth.service';
import { TransfersService } from '../src/transfers/transfers.service';
import { WithdrawalsService } from '../src/withdrawals/withdrawals.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { PinGuard } from '../src/pin/guards/pin.guard';
import { Transfer, TransferStatus } from '../src/transfers/entities/transfer.entity';
import { Withdrawal, WithdrawalStatus } from '../src/withdrawals/entities/withdrawal.entity';
import { User } from '../src/users/entities/user.entity';
import { Admin } from '../src/admin/entities/admin.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { Session } from '../src/auth/entities/session.entity';
import { jwtConfig } from '../src/config/jwt.config';
import { CacheService } from '../src/cache/cache.service';
import { REDIS_CLIENT } from '../src/cache/redis.module';

const MOCK_USER_ID = 'user-uuid-e2e';
const MOCK_USERNAME = 'alice';

const mockTokenResponse = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 900,
};

const mockTransfer: Partial<Transfer> = {
  id: 'transfer-uuid-1',
  fromUserId: MOCK_USER_ID,
  toUserId: 'user-uuid-2',
  fromUsername: MOCK_USERNAME,
  toUsername: 'bob',
  amount: '10.00',
  fee: '0.10',
  netAmount: '9.90',
  note: 'lunch',
  txHash: null,
  status: TransferStatus.PENDING,
  createdAt: new Date('2024-01-01'),
};

const mockWithdrawal: Partial<Withdrawal> = {
  id: 'withdrawal-uuid-1',
  userId: MOCK_USER_ID,
  toAddress: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE',
  amount: '50.00',
  fee: '0.50',
  netAmount: '49.50',
  txHash: null,
  status: WithdrawalStatus.PENDING,
  failureReason: null,
  createdAt: new Date('2024-01-01'),
};

const mockJwtAuthGuard = {
  canActivate: (ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    req.user = { id: MOCK_USER_ID, username: MOCK_USERNAME };
    return true;
  },
};

const mockPinGuard = { canActivate: () => true };

describe('Auth + Payment Flow (e2e)', () => {
  let app: INestApplication<App>;
  let authService: jest.Mocked<AuthService>;
  let transfersService: jest.Mocked<TransfersService>;
  let withdrawalsService: jest.Mocked<WithdrawalsService>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule, TransfersModule, WithdrawalsModule],
    })
      // ── Auth module stubs ──────────────────────────────────────────────────
      .overrideProvider(AuthService)
      .useValue({ register: jest.fn(), login: jest.fn(), refresh: jest.fn(), logout: jest.fn() })
      .overrideProvider(JwtService)
      .useValue({ sign: jest.fn().mockReturnValue('mock-token'), decode: jest.fn().mockReturnValue({ sessionId: 'session-1' }), verify: jest.fn() })
      .overrideProvider(jwtConfig.KEY)
      .useValue({ accessSecret: 'test', refreshSecret: 'test', accessExpiry: '15m', refreshExpiry: '7d' })
      .overrideProvider(getRepositoryToken(User))
      .useValue({ findOne: jest.fn(), create: jest.fn(), save: jest.fn() })
      .overrideProvider(getRepositoryToken(Admin))
      .useValue({ findOne: jest.fn() })
      .overrideProvider(getRepositoryToken(RefreshToken))
      .useValue({ findOne: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() })
      .overrideProvider(getRepositoryToken(Session))
      .useValue({ findOne: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() })
      .overrideProvider(CacheService)
      .useValue({ get: jest.fn(), set: jest.fn(), del: jest.fn() })
      .overrideProvider(REDIS_CLIENT)
      .useValue({ get: jest.fn(), set: jest.fn(), del: jest.fn() })
      // ── Transfers module stubs ─────────────────────────────────────────────
      .overrideProvider(TransfersService)
      .useValue({ create: jest.fn(), findAll: jest.fn(), findOne: jest.fn() })
      // ── Withdrawals module stubs ───────────────────────────────────────────
      .overrideProvider(WithdrawalsService)
      .useValue({ create: jest.fn(), findAll: jest.fn(), findOne: jest.fn() })
      // ── Guards ─────────────────────────────────────────────────────────────
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(PinGuard)
      .useValue(mockPinGuard)
      .compile();

    authService = moduleFixture.get(AuthService);
    transfersService = moduleFixture.get(TransfersService);
    withdrawalsService = moduleFixture.get(WithdrawalsService);

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Auth: Register ────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and returns tokens', async () => {
      authService.register.mockResolvedValue(mockTokenResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'alice@example.com', username: 'alice', password: 'supersecret123' })
        .expect(201);

      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number),
      });
      expect(authService.register).toHaveBeenCalledWith(
        { email: 'alice@example.com', username: 'alice', password: 'supersecret123' },
        expect.anything(),
        expect.anything(),
      );
    });

    it('returns 400 for invalid payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', username: 'a', password: 'short' })
        .expect(400);
    });
  });

  // ── Auth: Login ───────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    it('logs in and returns tokens', async () => {
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

    it('returns 400 for missing credentials', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);
    });
  });

  // ── Auth: Refresh ─────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('rotates refresh token and returns new pair', async () => {
      authService.refresh.mockResolvedValue(mockTokenResponse);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'old-refresh-token' })
        .expect(200);

      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
    });
  });

  // ── Auth: Logout ──────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('logs out and returns 204', async () => {
      authService.logout.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', 'Bearer mock-access-token')
        .expect(204);
    });
  });

  // ── Transfers: Create ─────────────────────────────────────────────────────

  describe('POST /api/v1/transfers', () => {
    it('creates a transfer and returns it', async () => {
      transfersService.create.mockResolvedValue(mockTransfer as Transfer);

      const res = await request(app.getHttpServer())
        .post('/api/v1/transfers')
        .set('Authorization', 'Bearer mock-access-token')
        .set('X-Transaction-Pin', '1234')
        .send({ toUsername: 'bob', amount: '10.00', note: 'lunch' })
        .expect(201);

      expect(res.body).toMatchObject({
        id: mockTransfer.id,
        status: TransferStatus.PENDING,
        amount: '10.00',
      });
    });

    it('returns 400 for invalid payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/transfers')
        .set('Authorization', 'Bearer mock-access-token')
        .send({ toUsername: '', amount: 'not-a-number' })
        .expect(400);
    });
  });

  // ── Transfers: Get status ─────────────────────────────────────────────────

  describe('GET /api/v1/transfers/:id', () => {
    it('returns transfer by id', async () => {
      transfersService.findOne.mockResolvedValue(mockTransfer as Transfer);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/transfers/${mockTransfer.id}`)
        .set('Authorization', 'Bearer mock-access-token')
        .expect(200);

      expect(res.body).toMatchObject({
        id: mockTransfer.id,
        status: TransferStatus.PENDING,
      });
    });
  });

  // ── Withdrawals: Create ───────────────────────────────────────────────────

  describe('POST /api/v1/withdrawals', () => {
    it('creates a withdrawal and returns it', async () => {
      withdrawalsService.create.mockResolvedValue(mockWithdrawal as Withdrawal);

      const res = await request(app.getHttpServer())
        .post('/api/v1/withdrawals')
        .set('Authorization', 'Bearer mock-access-token')
        .send({
          toAddress: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE',
          amount: '50.00',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: mockWithdrawal.id,
        status: WithdrawalStatus.PENDING,
        amount: '50.00',
      });
    });

    it('returns 400 for invalid Stellar address', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/withdrawals')
        .set('Authorization', 'Bearer mock-access-token')
        .send({ toAddress: 'not-a-stellar-address', amount: '50.00' })
        .expect(400);
    });
  });

  // ── Withdrawals: Get status ───────────────────────────────────────────────

  describe('GET /api/v1/withdrawals/:id', () => {
    it('returns withdrawal by id', async () => {
      withdrawalsService.findOne.mockResolvedValue(mockWithdrawal as Withdrawal);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/withdrawals/${mockWithdrawal.id}`)
        .set('Authorization', 'Bearer mock-access-token')
        .expect(200);

      expect(res.body).toMatchObject({
        id: mockWithdrawal.id,
        status: WithdrawalStatus.PENDING,
      });
    });
  });
});
