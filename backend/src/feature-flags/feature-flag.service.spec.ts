import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TierName } from '../tier-config/entities/tier-config.entity';
import { CacheService } from '../cache/cache.service';
import { FeatureFlagService, CachedFeatureFlag } from './feature-flag.service';
import {
  FeatureFlag,
  FeatureFlagStatus,
} from './entities/feature-flag.entity';

function slim(overrides: Partial<CachedFeatureFlag> = {}): CachedFeatureFlag {
  return {
    id: 'ff-1',
    key: 'test_flag',
    status: FeatureFlagStatus.PERCENTAGE,
    percentage: 50,
    enabledTiers: null,
    enabledUserIds: null,
    ...overrides,
  };
}

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  const repo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const cache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        { provide: getRepositoryToken(FeatureFlag), useValue: repo },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(FeatureFlagService);
  });

  describe('isEnabled / evaluateFlag', () => {
    it('disabled → false', async () => {
      cache.get.mockResolvedValue(
        slim({ status: FeatureFlagStatus.DISABLED, percentage: null }),
      );
      await expect(
        service.isEnabled('test_flag', 'u1', TierName.GOLD),
      ).resolves.toBe(false);
    });

    it('enabled → true', async () => {
      cache.get.mockResolvedValue(
        slim({ status: FeatureFlagStatus.ENABLED, percentage: null }),
      );
      await expect(
        service.isEnabled('test_flag', 'u1', TierName.SILVER),
      ).resolves.toBe(true);
    });

    it('percentage rollout is stable per user+key', async () => {
      cache.get.mockResolvedValue(
        slim({
          key: 'scheduled_payouts',
          status: FeatureFlagStatus.PERCENTAGE,
          percentage: 50,
        }),
      );
      const a = await service.isEnabled(
        'scheduled_payouts',
        'sticky-user',
        TierName.SILVER,
      );
      const b = await service.isEnabled(
        'scheduled_payouts',
        'sticky-user',
        TierName.SILVER,
      );
      expect(a).toBe(b);
    });

    it('tier rollout respects hierarchy (Gold list includes Black users)', async () => {
      const row = slim({
        key: 'bulk_payments',
        status: FeatureFlagStatus.TIER,
        percentage: null,
        enabledTiers: ['gold', 'black'],
      });
      expect(service.evaluateFlag(row, 'u1', TierName.BLACK)).toBe(true);
      expect(service.evaluateFlag(row, 'u1', TierName.SILVER)).toBe(false);
    });

    it('users list matches exact user id', async () => {
      const row = slim({
        status: FeatureFlagStatus.USERS,
        percentage: null,
        enabledUserIds: ['alpha', 'beta'],
      });
      expect(service.evaluateFlag(row, 'alpha', TierName.SILVER)).toBe(true);
      expect(service.evaluateFlag(row, 'gamma', TierName.SILVER)).toBe(false);
    });
  });

  describe('updateByKey', () => {
    it('invalidates Redis cache key immediately', async () => {
      const row = {
        id: 'id1',
        key: 'k1',
        description: 'old',
        status: FeatureFlagStatus.ENABLED,
        percentage: null,
        enabledTiers: null,
        enabledUserIds: null,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as FeatureFlag;
      repo.findOne.mockResolvedValue(row);
      repo.save.mockImplementation(async (r: FeatureFlag) => r);
      cache.get.mockResolvedValue(null);

      await service.updateByKey('k1', { description: 'new text' });

      expect(cache.del).toHaveBeenCalledWith('ff:k1');
      expect(cache.set).toHaveBeenCalled();
    });

    it('throws when flag missing', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.updateByKey('missing', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
