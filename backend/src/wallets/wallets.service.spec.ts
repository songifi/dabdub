import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { Wallet } from './entities/wallet.entity';
import { stellarConfig } from '../config/stellar.config';
import {
  encryptAes256Gcm,
  decryptAes256Gcm,
  derive32ByteKeyFromString,
} from '../webhooks/webhooks.crypto';

// Mock the entire soroban module to avoid its duplicate-class compile error
jest.mock('../soroban/soroban.service');
import { SorobanService } from '../soroban/soroban.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockWalletRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

// Mock axios for friendbot
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({ data: {} }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockStellarConfig = {
  adminSecretKey: 'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  rpcUrl: 'https://rpc.test.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  receiveAddress: '',
  usdcIssuer: '',
};

const makeWallet = (overrides: Partial<Wallet> = {}): Wallet => {
  const encKey = derive32ByteKeyFromString(mockStellarConfig.adminSecretKey);
  const encrypted = encryptAes256Gcm('STEST_SECRET_KEY', encKey);
  const [iv] = encrypted.split('.');
  return {
    id: 'wallet-uuid-1',
    userId: 'user-uuid-1',
    stellarAddress: 'GABC123',
    encryptedSecretKey: encrypted,
    iv,
    balance: '10000000',
    stakedBalance: '5000000',
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Wallet;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WalletsService', () => {
  let service: WalletsService;
  let soroban: jest.Mocked<SorobanService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletsService,
        { provide: getRepositoryToken(Wallet), useValue: mockWalletRepo },
        { provide: SorobanService, useValue: new (SorobanService as any)() },
        { provide: stellarConfig.KEY, useValue: mockStellarConfig },
      ],
    }).compile();

    service = module.get<WalletsService>(WalletsService);
    soroban = module.get(SorobanService);

    // Wire up mock implementations
    soroban.registerUser = jest.fn().mockResolvedValue(undefined);
    soroban.getUsername = jest.fn().mockResolvedValue('alice');
    soroban.getBalance = jest.fn().mockResolvedValue('20000000');
    soroban.getStakeBalance = jest.fn().mockResolvedValue('8000000');
  });

  // ── provision ──────────────────────────────────────────────────────────────

  describe('provision', () => {
    it('creates a wallet and calls registerUser', async () => {
      mockWalletRepo.findOne.mockResolvedValue(null);
      mockWalletRepo.create.mockImplementation((data: Partial<Wallet>) => ({ ...data }));
      mockWalletRepo.save.mockImplementation((w: Wallet) => Promise.resolve({ ...w, id: 'wallet-uuid-new' }));

      const wallet = await service.provision('user-uuid-1', 'alice');

      expect(mockWalletRepo.findOne).toHaveBeenCalledWith({ where: { userId: 'user-uuid-1' } });
      expect(mockWalletRepo.save).toHaveBeenCalledTimes(1);
      expect(soroban.registerUser).toHaveBeenCalledWith(
        'alice',
        expect.stringMatching(/^G[A-Z2-7]{55}$/), // valid Stellar public key
      );

      expect(wallet.userId).toBe('user-uuid-1');
      expect(wallet.stellarAddress).toMatch(/^G[A-Z2-7]{55}$/);
      expect(wallet.encryptedSecretKey).toBeTruthy();
    });

    it('throws ConflictException if wallet already exists', async () => {
      mockWalletRepo.findOne.mockResolvedValue(makeWallet());

      await expect(service.provision('user-uuid-1', 'alice')).rejects.toThrow(ConflictException);
      expect(soroban.registerUser).not.toHaveBeenCalled();
    });
  });

  // ── decryptSecretKey round-trip ────────────────────────────────────────────

  describe('decryptSecretKey (via provision round-trip)', () => {
    it('encrypts and decrypts the secret key correctly', () => {
      const encKey = derive32ByteKeyFromString(mockStellarConfig.adminSecretKey);
      const original = 'STEST_SECRET_KEY_ROUND_TRIP';
      const encrypted = encryptAes256Gcm(original, encKey);
      const decrypted = decryptAes256Gcm(encrypted, encKey);
      expect(decrypted).toBe(original);
    });
  });

  // ── syncBalance ────────────────────────────────────────────────────────────

  describe('syncBalance', () => {
    it('fetches balances from soroban and updates the DB row', async () => {
      const wallet = makeWallet();
      mockWalletRepo.findOne.mockResolvedValue(wallet);
      mockWalletRepo.save.mockImplementation((w: Wallet) => Promise.resolve(w));

      const updated = await service.syncBalance('user-uuid-1');

      expect(soroban.getBalance).toHaveBeenCalledWith('alice');
      expect(soroban.getStakeBalance).toHaveBeenCalledWith('alice');
      expect(updated.balance).toBe('20000000');
      expect(updated.stakedBalance).toBe('8000000');
      expect(updated.lastSyncedAt).toBeInstanceOf(Date);
      expect(mockWalletRepo.save).toHaveBeenCalledWith(updated);
    });

    it('throws NotFoundException when wallet does not exist', async () => {
      mockWalletRepo.findOne.mockResolvedValue(null);
      await expect(service.syncBalance('user-uuid-1')).rejects.toThrow(NotFoundException);
    });
  });
});
