import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

// Mock config to bypass validation during unit tests
jest.mock('../config', () => ({
  redisConfig: {
    KEY: 'redisConfig',
    host: 'localhost',
    port: 6379,
    password: '',
  },
  appConfig: { KEY: 'appConfig' },
}));

import { BalanceService } from './balance.service';
import { User } from '../users/entities/user.entity';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';
import { BalanceSnapshot } from './entities/balance-snapshot.entity';
import { SorobanService } from '../soroban/soroban.service';
import { RatesService } from '../rates/rates.service';
import { CacheService } from '../cache/cache.service';

describe('BalanceService', () => {
  let service: BalanceService;
  let userRepo: any;
  let txRepo: any;
  let snapshotRepo: any;
  let sorobanService: any;
  let ratesService: any;
  let cacheService: any;

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
  };

  const mockRate = {
    rate: '1500',
    fetchedAt: new Date(),
    source: 'bybit_p2p',
    isStale: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            createQueryBuilder: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(BalanceSnapshot),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: SorobanService,
          useValue: {
            getBalance: jest.fn(),
            getStakeBalance: jest.fn(),
          },
        },
        {
          provide: RatesService,
          useValue: {
            getRate: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    userRepo = module.get(getRepositoryToken(User));
    txRepo = module.get(getRepositoryToken(Transaction));
    snapshotRepo = module.get(getRepositoryToken(BalanceSnapshot));
    sorobanService = module.get(SorobanService);
    ratesService = module.get(RatesService);
    cacheService = module.get(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── getBalance ──────────────────────────────────────────────

  describe('getBalance', () => {
    it('should return cached balance if available', async () => {
      const cachedBalance = {
        balanceUsdc: '100.00',
        stakedBalanceUsdc: '50.00',
        totalUsdc: '150.00',
        balanceNgn: '150000.00',
        stakedBalanceNgn: '75000.00',
        rate: '1500',
        lastSyncedAt: new Date().toISOString(),
        change24h: '10.00',
      };

      cacheService.get.mockResolvedValue(cachedBalance);

      const result = await service.getBalance('user-1');

      expect(cacheService.get).toHaveBeenCalledWith('balance:user-1');
      expect(result).toEqual(cachedBalance);
    });

    it('should compute balance from DB if cache is empty', async () => {
      cacheService.get.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(mockUser);

      // Mock stake query
      const stakeQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ staked: '50' }),
      };

      // Mock liquid query
      const liquidQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ liquid: '150' }),
      };

      // Mock 24h change query
      const changeQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ change: '10' }),
      };

      txRepo.createQueryBuilder
        .mockReturnValueOnce(stakeQueryBuilder)
        .mockReturnValueOnce(liquidQueryBuilder)
        .mockReturnValueOnce(changeQueryBuilder);

      ratesService.getRate.mockResolvedValue(mockRate);

      const result = await service.getBalance('user-1');

      expect(result.balanceUsdc).toBeDefined();
      expect(result.stakedBalanceUsdc).toBeDefined();
      expect(result.totalUsdc).toBeDefined();
      expect(result.rate).toBe('1500');
    });

    it('should throw NotFoundException if user not found', async () => {
      cacheService.get.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getBalance('invalid-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── refreshBalance ──────────────────────────────────────────

  describe('refreshBalance', () => {
    it('should fetch balance from Soroban and update cache', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      sorobanService.getBalance.mockResolvedValue('100');
      sorobanService.getStakeBalance.mockResolvedValue('50');
      ratesService.getRate.mockResolvedValue(mockRate);

      // Mock 24h change query
      const changeQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ change: '5' }),
      };
      txRepo.createQueryBuilder.mockReturnValue(changeQueryBuilder);

      snapshotRepo.findOne.mockResolvedValue(null);
      snapshotRepo.create.mockReturnValue({
        userId: mockUser.id,
        snapshotDate: new Date().toISOString().split('T')[0],
        balanceUsdc: '100',
        stakedBalanceUsdc: '50',
        totalUsdc: '150',
        rate: '1500',
      });
      snapshotRepo.save.mockResolvedValue({});

      const result = await service.refreshBalance('user-1');

      expect(sorobanService.getBalance).toHaveBeenCalledWith('testuser');
      expect(sorobanService.getStakeBalance).toHaveBeenCalledWith('testuser');
      expect(cacheService.set).toHaveBeenCalledWith(
        'balance:user-1',
        expect.any(Object),
        30,
      );
      expect(result.balanceUsdc).toBe('100.00000000');
      expect(result.stakedBalanceUsdc).toBe('50.00000000');
      expect(result.totalUsdc).toBe('150.00000000');
      expect(result.balanceNgn).toBe('150000.00');
      expect(result.stakedBalanceNgn).toBe('75000.00');
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.refreshBalance('invalid-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── getBalanceHistory ───────────────────────────────────────

  describe('getBalanceHistory', () => {
    it('should return 30 days of balance snapshots', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      const mockSnapshots = Array.from({ length: 30 }, (_, i) => ({
        id: `snapshot-${i}`,
        userId: mockUser.id,
        snapshotDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        balanceUsdc: '100',
        stakedBalanceUsdc: '50',
        totalUsdc: '150',
        rate: '1500',
      }));

      snapshotRepo.find.mockResolvedValue(mockSnapshots);

      const result = await service.getBalanceHistory('user-1');

      expect(snapshotRepo.find).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          snapshotDate: expect.any(Object),
        },
        order: { snapshotDate: 'ASC' },
      });
      expect(result.points).toHaveLength(30);
      expect(result.points[0]).toHaveProperty('date');
      expect(result.points[0]).toHaveProperty('balanceUsdc');
      expect(result.points[0]).toHaveProperty('stakedBalanceUsdc');
      expect(result.points[0]).toHaveProperty('totalUsdc');
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getBalanceHistory('invalid-user'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── 24h change calculation ──────────────────────────────────

  describe('calculate24hChange', () => {
    it('should return null when no transactions in last 24h', async () => {
      const changeQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ change: '0' }),
      };
      txRepo.createQueryBuilder.mockReturnValue(changeQueryBuilder);

      // Access private method via bracket notation
      const change = await (service as any).calculate24hChange('user-1');

      expect(change).toBeNull();
    });

    it('should return correct change when transactions exist', async () => {
      const changeQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ change: '25.5' }),
      };
      txRepo.createQueryBuilder.mockReturnValue(changeQueryBuilder);

      const change = await (service as any).calculate24hChange('user-1');

      expect(change).toBe('25.50000000');
    });
  });

  // ── invalidateCache ─────────────────────────────────────────

  describe('invalidateCache', () => {
    it('should delete balance cache for user', async () => {
      await service.invalidateCache('user-1');

      expect(cacheService.del).toHaveBeenCalledWith('balance:user-1');
    });
  });

  // ── Daily snapshot saving ───────────────────────────────────

  describe('saveDailySnapshot', () => {
    it('should create new snapshot if none exists for today', async () => {
      snapshotRepo.findOne.mockResolvedValue(null);
      snapshotRepo.create.mockReturnValue({
        userId: 'user-1',
        snapshotDate: '2024-01-01',
        balanceUsdc: '100',
        stakedBalanceUsdc: '50',
        totalUsdc: '150',
        rate: '1500',
      });
      snapshotRepo.save.mockResolvedValue({});

      const balance = {
        balanceUsdc: '100',
        stakedBalanceUsdc: '50',
        totalUsdc: '150',
        rate: '1500',
        balanceNgn: '150000',
        stakedBalanceNgn: '75000',
        lastSyncedAt: new Date().toISOString(),
        change24h: null,
      };

      await (service as any).saveDailySnapshot(
        'user-1',
        balance,
        new Date('2024-01-01'),
      );

      expect(snapshotRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        snapshotDate: '2024-01-01',
        balanceUsdc: '100',
        stakedBalanceUsdc: '50',
        totalUsdc: '150',
        rate: '1500',
      });
      expect(snapshotRepo.save).toHaveBeenCalled();
    });

    it('should update existing snapshot if one exists for today', async () => {
      const existingSnapshot = {
        id: 'snapshot-1',
        userId: 'user-1',
        snapshotDate: '2024-01-01',
        balanceUsdc: '90',
        stakedBalanceUsdc: '40',
        totalUsdc: '130',
        rate: '1450',
      };

      snapshotRepo.findOne.mockResolvedValue(existingSnapshot);
      snapshotRepo.save.mockResolvedValue({});

      const balance = {
        balanceUsdc: '100',
        stakedBalanceUsdc: '50',
        totalUsdc: '150',
        rate: '1500',
        balanceNgn: '150000',
        stakedBalanceNgn: '75000',
        lastSyncedAt: new Date().toISOString(),
        change24h: null,
      };

      await (service as any).saveDailySnapshot(
        'user-1',
        balance,
        new Date('2024-01-01'),
      );

      expect(existingSnapshot.balanceUsdc).toBe('100');
      expect(existingSnapshot.stakedBalanceUsdc).toBe('50');
      expect(existingSnapshot.totalUsdc).toBe('150');
      expect(existingSnapshot.rate).toBe('1500');
      expect(snapshotRepo.save).toHaveBeenCalledWith(existingSnapshot);
    });
  });
});
