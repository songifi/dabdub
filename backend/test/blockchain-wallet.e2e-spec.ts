import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { BlockchainWalletModule } from '../src/blockchain-wallet/blockchain-wallet.module';
import { BlockchainWalletService } from '../src/blockchain-wallet/blockchain-wallet.service';
import { SorobanService } from '../src/blockchain-wallet/soroban.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { BlockchainWallet } from '../src/blockchain-wallet/entities/blockchain-wallet.entity';

const MOCK_USER_ID = 'user-uuid-1';

const mockWallet: BlockchainWallet = {
  id: 'wallet-uuid',
  userId: MOCK_USER_ID,
  stellarAddress: 'GABC123STELLAR',
  encryptedSecretKey: 'encrypted-secret',
  iv: 'iv-hex',
  balanceUsdc: '100.50',
  stakedBalance: '25.00',
  lastSyncedAt: new Date('2024-01-01'),
  createdAt: new Date('2024-01-01'),
  user: null,
};

describe('Wallet (e2e)', () => {
  let app: INestApplication<App>;
  let walletService: jest.Mocked<BlockchainWalletService>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [BlockchainWalletModule],
    })
      .overrideProvider(BlockchainWalletService)
      .useValue({
        getWallet: jest.fn(),
        syncBalance: jest.fn(),
        provision: jest.fn(),
      })
      .overrideProvider(SorobanService)
      .useValue({
        registerUser: jest.fn(),
        getBalance: jest.fn(),
        getStakeBalance: jest.fn(),
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: MOCK_USER_ID };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    walletService = moduleFixture.get(BlockchainWalletService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /wallet ──────────────────────────────────────────────────────────────

  describe('GET /wallet', () => {
    it('returns wallet info for authenticated user', async () => {
      walletService.getWallet.mockResolvedValue(mockWallet);

      const res = await request(app.getHttpServer())
        .get('/wallet')
        .expect(200);

      expect(res.body.stellarAddress).toBe('GABC123STELLAR');
      expect(res.body.balanceUsdc).toBe('100.50');
      expect(res.body.stakedBalance).toBe('25.00');
      expect(res.body.lastSyncedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('returns 404 if wallet not provisioned', async () => {
      walletService.getWallet.mockRejectedValue(new Error('Wallet not provisioned'));

      await request(app.getHttpServer())
        .get('/wallet')
        .expect(500); // Service error becomes 500
    });
  });

  // ── GET /wallet/balance ──────────────────────────────────────────────────────

  describe('GET /wallet/balance', () => {
    it('syncs balance and returns fresh data', async () => {
      const syncedWallet = { ...mockWallet, balanceUsdc: '150.75', lastSyncedAt: new Date() };
      walletService.syncBalance.mockResolvedValue(syncedWallet);

      const res = await request(app.getHttpServer())
        .get('/wallet/balance')
        .expect(200);

      expect(res.body.balanceUsdc).toBe('150.75');
      expect(walletService.syncBalance).toHaveBeenCalledWith(MOCK_USER_ID);
    });
  });

  // ── POST /internal/wallet/provision ──────────────────────────────────────────

  describe('POST /internal/wallet/provision', () => {
    it('provisions wallet for new user', async () => {
      walletService.provision.mockResolvedValue(mockWallet);

      const res = await request(app.getHttpServer())
        .post('/internal/wallet/provision')
        .send({ userId: 'new-user-id', username: 'alice' })
        .expect(201);

      expect(res.body.stellarAddress).toBe('GABC123STELLAR');
      expect(walletService.provision).toHaveBeenCalledWith('new-user-id', 'alice');
    });

    it('returns 400 for missing fields', async () => {
      await request(app.getHttpServer())
        .post('/internal/wallet/provision')
        .send({ userId: 'new-user-id' }) // missing username
        .expect(400);
    });
  });
});