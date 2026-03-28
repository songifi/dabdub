import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BlockchainWalletService, WALLET_PROVISIONED_EVENT } from './blockchain-wallet.service';
import { SorobanService } from './soroban.service';
import { StellarAssetService } from '../stellar/stellar-asset.service';
import { BlockchainWallet } from './entities/blockchain-wallet.entity';

const MOCK_ENC_KEY = 'test-encryption-key-32-chars-long!!';

const mockWallet = (): BlockchainWallet => ({
  id: 'wallet-uuid',
  userId: 'user-uuid',
  stellarAddress: 'GABC123',
  encryptedSecretKey: '',
  iv: '',
  balanceUsdc: '0',
  stakedBalance: '0',
  lastSyncedAt: null,
  createdAt: new Date(),
  user: null,
});

describe('BlockchainWalletService', () => {
  let service: BlockchainWalletService;
  let walletRepo: any;
  let sorobanService: jest.Mocked<SorobanService>;
  let stellarAssetService: jest.Mocked<StellarAssetService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainWalletService,
        {
          provide: getRepositoryToken(BlockchainWallet),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: SorobanService,
          useValue: {
            registerUser: jest.fn(),
            getBalance: jest.fn(),
            getStakeBalance: jest.fn(),
          },
        },
        {
          provide: StellarAssetService,
          useValue: {
            ensureTrustLine: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              if (key === 'STELLAR_WALLET_ENCRYPTION_KEY') return MOCK_ENC_KEY;
              if (key === 'STELLAR_NETWORK') return 'TESTNET';
              if (key === 'STELLAR_HORIZON_URL') return 'https://horizon-testnet.stellar.org';
              return def;
            }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(BlockchainWalletService);
    walletRepo = module.get(getRepositoryToken(BlockchainWallet));
    sorobanService = module.get(SorobanService);
    stellarAssetService = module.get(StellarAssetService);
    eventEmitter = module.get(EventEmitter2);
    configService = module.get(ConfigService);
  });

  // ── provision ───────────────────────────────────────────────────────────────

  describe('provision', () => {
    it('creates a BlockchainWallet and calls registerUser', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      const wallet = mockWallet();
      walletRepo.create.mockReturnValue(wallet);
      walletRepo.save.mockResolvedValue(wallet);
      sorobanService.registerUser.mockResolvedValue(undefined);

      // Mock friendbot — patch the Horizon.Server constructor
      jest.spyOn(service as any, 'provision').mockImplementationOnce(undefined);

      // Re-test with actual implementation but mock Horizon server
      const StellarSdk = require('@stellar/stellar-sdk');
      const mockFriendbot = { call: jest.fn().mockResolvedValue({}) };
      jest.spyOn(StellarSdk.Horizon.Server.prototype, 'friendbot').mockReturnValue(mockFriendbot);

      const result = await service.provision('user-uuid', 'alice');

      expect(walletRepo.save).toHaveBeenCalled();
      expect(sorobanService.registerUser).toHaveBeenCalledWith('alice', expect.any(String));
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        WALLET_PROVISIONED_EVENT,
        expect.objectContaining({ userId: 'user-uuid' }),
      );
    });

    it('throws ConflictException if wallet already exists', async () => {
      walletRepo.findOne.mockResolvedValue(mockWallet());
      await expect(service.provision('user-uuid', 'alice')).rejects.toThrow(ConflictException);
    });

    it('still saves wallet if Soroban registerUser fails', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      const wallet = mockWallet();
      walletRepo.create.mockReturnValue(wallet);
      walletRepo.save.mockResolvedValue(wallet);
      sorobanService.registerUser.mockRejectedValue(new Error('contract error'));

      const StellarSdk = require('@stellar/stellar-sdk');
      const mockFriendbot = { call: jest.fn().mockResolvedValue({}) };
      jest.spyOn(StellarSdk.Horizon.Server.prototype, 'friendbot').mockReturnValue(mockFriendbot);

      const result = await service.provision('user-uuid', 'alice');
      expect(result).toBeDefined();
      expect(walletRepo.save).toHaveBeenCalled();
    });

    it('calls ensureTrustLine before registerUser during provisioning', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      const wallet = mockWallet();
      walletRepo.create.mockReturnValue(wallet);
      walletRepo.save.mockResolvedValue(wallet);

      const callOrder: string[] = [];
      stellarAssetService.ensureTrustLine.mockImplementation(async () => {
        callOrder.push('ensureTrustLine');
      });
      sorobanService.registerUser.mockImplementation(async () => {
        callOrder.push('registerUser');
      });

      const StellarSdk = require('@stellar/stellar-sdk');
      const mockFriendbot = { call: jest.fn().mockResolvedValue({}) };
      jest.spyOn(StellarSdk.Horizon.Server.prototype, 'friendbot').mockReturnValue(mockFriendbot);

      await service.provision('user-uuid', 'alice');

      expect(callOrder).toEqual(['ensureTrustLine', 'registerUser']);
    });
  });

  // ── decryptSecretKey AES round-trip ─────────────────────────────────────────

  describe('decryptSecretKey', () => {
    it('correctly encrypts and decrypts a Stellar secret key', () => {
      const secret = 'SCZANGBA5RLGSRSGIDJIS7LJFTD3GVLKIGUTHARCHUU5MQNKQIE3EDXX';
      const { ciphertext, iv } = (service as any).encrypt(secret);

      const fakeWallet = { encryptedSecretKey: ciphertext, iv } as BlockchainWallet;
      const decrypted = service.decryptSecretKey(fakeWallet);

      expect(decrypted).toBe(secret);
    });

    it('produces different ciphertext each call (random IV)', () => {
      const secret = 'SCZANGBA5RLGSRSGIDJIS7LJFTD3GVLKIGUTHARCHUU5MQNKQIE3EDXX';
      const first = (service as any).encrypt(secret);
      const second = (service as any).encrypt(secret);
      expect(first.iv).not.toBe(second.iv);
      expect(first.ciphertext).not.toBe(second.ciphertext);
    });
  });

  // ── syncBalance ─────────────────────────────────────────────────────────────

  describe('syncBalance', () => {
    it('updates balanceUsdc, stakedBalance and lastSyncedAt', async () => {
      const wallet = mockWallet();
      walletRepo.findOne.mockResolvedValue(wallet);
      sorobanService.getBalance.mockResolvedValue('100.5');
      sorobanService.getStakeBalance.mockResolvedValue('25.0');
      walletRepo.save.mockImplementation((w) => Promise.resolve(w));

      const result = await service.syncBalance('user-uuid');

      expect(result.balanceUsdc).toBe('100.5');
      expect(result.stakedBalance).toBe('25.0');
      expect(result.lastSyncedAt).toBeInstanceOf(Date);
      expect(walletRepo.save).toHaveBeenCalled();
    });

    it('throws if wallet not found', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      await expect(service.syncBalance('user-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getWallet ────────────────────────────────────────────────────────────────

  describe('getWallet', () => {
    it('returns wallet when found', async () => {
      const wallet = mockWallet();
      walletRepo.findOne.mockResolvedValue(wallet);
      const result = await service.getWallet('user-uuid');
      expect(result.userId).toBe('user-uuid');
    });

    it('throws NotFoundException when wallet not provisioned', async () => {
      walletRepo.findOne.mockResolvedValue(null);
      await expect(service.getWallet('user-uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
