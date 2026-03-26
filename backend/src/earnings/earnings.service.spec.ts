import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

// Mock config to bypass validation during unit tests
jest.mock('../config', () => ({
  redisConfig: { KEY: 'redisConfig', host: 'localhost', port: 6379, password: '' },
  appConfig: { KEY: 'appConfig' },
}));

import { EarningsService } from './earnings.service';
import { User } from '../users/entities/user.entity';
import { TierConfig, TierName } from '../tier-config/entities/tier-config.entity';
import { Transaction, TransactionType } from '../transactions/entities/transaction.entity';
import { YieldEntry } from './entities/yield-entry.entity';
import { CacheService } from '../cache/cache.service';

describe('EarningsService', () => {
  let service: EarningsService;
  let userRepo: any;
  let tierRepo: any;
  let txRepo: any;
  let yieldRepo: any;
  let cacheService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EarningsService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TierConfig),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(YieldEntry),
          useValue: {
            findAndCount: jest.fn(),
            createQueryBuilder: jest.fn(),
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

    service = module.get<EarningsService>(EarningsService);
    userRepo = module.get(getRepositoryToken(User));
    tierRepo = module.get(getRepositoryToken(TierConfig));
    txRepo = module.get(getRepositoryToken(Transaction));
    yieldRepo = module.get(getRepositoryToken(YieldEntry));
    cacheService = module.get(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Projection math ─────────────────────────────────────────

  describe('getProjections', () => {
    const userId = 'user-1';
    const user = { id: userId, tier: TierName.GOLD };
    const tierConfig = { tier: TierName.GOLD, yieldApyPercent: '8.00', stakeLockupDays: 30 };

    function mockStakeQueryBuilder(stakedAmount: string) {
      const qb: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ staked: stakedAmount }),
      };
      txRepo.createQueryBuilder.mockReturnValue(qb);
    }

    it('should compute 30-day projection correctly: (1000 × 0.08 × 30/365)', async () => {
      userRepo.findOne.mockResolvedValue(user);
      tierRepo.findOne.mockResolvedValue(tierConfig);
      mockStakeQueryBuilder('1000.00000000');

      const result = await service.getProjections(userId, 0);

      const expected30 = (1000 * (8 / 100) * (30 / 365));
      expect(result.projections[0].days).toBe(30);
      expect(parseFloat(result.projections[0].projectedYieldUsdc)).toBeCloseTo(expected30, 4);
    });

    it('should compute 365-day projection with additional stake: (1000 + 500) × 0.08 × 365/365 = 120', async () => {
      userRepo.findOne.mockResolvedValue(user);
      tierRepo.findOne.mockResolvedValue(tierConfig);
      mockStakeQueryBuilder('1000.00000000');

      const result = await service.getProjections(userId, 500);

      // 365-day projection is the last element
      const proj365 = result.projections.find((p) => p.days === 365);
      expect(proj365).toBeDefined();
      expect(parseFloat(proj365!.projectedYieldUsdc)).toBeCloseTo(120, 4);
    });

    it('should return zero projections when staked balance is zero', async () => {
      userRepo.findOne.mockResolvedValue(user);
      tierRepo.findOne.mockResolvedValue(tierConfig);
      mockStakeQueryBuilder('0');

      const result = await service.getProjections(userId, 0);

      result.projections.forEach((p) => {
        expect(parseFloat(p.projectedYieldUsdc)).toBe(0);
      });
    });
  });

  // ── Dashboard / canUnstakeNow ────────────────────────────────

  describe('getDashboard', () => {
    const userId = 'user-1';
    const user = { id: userId, tier: TierName.GOLD };
    const tierConfig = {
      tier: TierName.GOLD,
      yieldApyPercent: '8.00',
      stakeLockupDays: 30,
    };

    function mockAllQueryBuilders(staked: string, liquid: string, yieldTotal: string) {
      // Three createQueryBuilder calls: staked, liquid, yield
      const makeQb = (result: Record<string, string>) => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(result),
      });
      txRepo.createQueryBuilder
        .mockReturnValueOnce(makeQb({ staked }))
        .mockReturnValueOnce(makeQb({ liquid }))
        .mockReturnValueOnce(makeQb({ totalYield: yieldTotal }));
    }

    it('should return canUnstakeNow = true when lockup period has passed', async () => {
      cacheService.get.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(user);
      tierRepo.findOne.mockResolvedValue(tierConfig);
      mockAllQueryBuilders('1000', '500', '50');

      // Last stake was 60 days ago (lockup is 30 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      txRepo.findOne.mockResolvedValue({ createdAt: sixtyDaysAgo, type: TransactionType.STAKE });
      cacheService.set.mockResolvedValue(true);

      const result = await service.getDashboard(userId);

      expect(result.canUnstakeNow).toBe(true);
      expect(result.nextUnstakeDate).toBeNull();
    });

    it('should return canUnstakeNow = false when within lockup period', async () => {
      cacheService.get.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(user);
      tierRepo.findOne.mockResolvedValue(tierConfig);
      mockAllQueryBuilders('1000', '500', '50');

      // Last stake was 5 days ago (lockup is 30 days)
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      txRepo.findOne.mockResolvedValue({ createdAt: fiveDaysAgo, type: TransactionType.STAKE });
      cacheService.set.mockResolvedValue(true);

      const result = await service.getDashboard(userId);

      expect(result.canUnstakeNow).toBe(false);
      expect(result.nextUnstakeDate).not.toBeNull();
    });

    it('should sum only yield_credit transactions for totalYieldEarnedUsdc', async () => {
      cacheService.get.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(user);
      tierRepo.findOne.mockResolvedValue(tierConfig);

      // The third query builder returns totalYield = '123.45678900'
      mockAllQueryBuilders('1000', '500', '123.45678900');

      txRepo.findOne.mockResolvedValue(null); // No stake transactions
      cacheService.set.mockResolvedValue(true);

      const result = await service.getDashboard(userId);

      expect(result.totalYieldEarnedUsdc).toBe('123.45678900');

      // Verify that the third query builder was called with yield_credit type
      const thirdCallArgs = txRepo.createQueryBuilder.mock.results[2].value;
      const whereCall = thirdCallArgs.andWhere.mock.calls[0];
      expect(whereCall[1]).toEqual({ type: TransactionType.YIELD_CREDIT });
    });

    it('should return cached dashboard on cache hit', async () => {
      const cachedDashboard = {
        stakedBalanceUsdc: '1000.00000000',
        liquidBalanceUsdc: '500.00000000',
        currentApyPercent: '8.00',
        totalYieldEarnedUsdc: '50.00000000',
        projectedDailyYieldUsdc: '0.21917808',
        projectedMonthlyYieldUsdc: '6.57534247',
        stakeLockupDays: 30,
        canUnstakeNow: true,
        nextUnstakeDate: null,
      };
      cacheService.get.mockResolvedValue(cachedDashboard);

      const result = await service.getDashboard(userId);

      expect(result).toEqual(cachedDashboard);
      // Should NOT have queried the DB
      expect(userRepo.findOne).not.toHaveBeenCalled();
      expect(txRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should cache the result on cache miss', async () => {
      cacheService.get.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(user);
      tierRepo.findOne.mockResolvedValue(tierConfig);
      mockAllQueryBuilders('1000', '500', '50');
      txRepo.findOne.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(true);

      await service.getDashboard(userId);

      expect(cacheService.set).toHaveBeenCalledWith(
        `earnings:${userId}`,
        expect.objectContaining({ stakedBalanceUsdc: '1000.00000000' }),
        60,
      );
    });

    it('should throw NotFoundException for unknown user', async () => {
      cacheService.get.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.getDashboard(userId)).rejects.toThrow(NotFoundException);
    });
  });

  // ── Cache invalidation ─────────────────────────────────────

  describe('invalidateCache', () => {
    it('should delete the earnings cache key', async () => {
      cacheService.del.mockResolvedValue(undefined);

      await service.invalidateCache('user-1');

      expect(cacheService.del).toHaveBeenCalledWith('earnings:user-1');
    });
  });
});
