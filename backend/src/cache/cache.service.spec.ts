import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CacheService } from './cache.service';
import { CacheMetricsService } from './cache-metrics.service';

describe('CacheService', () => {
  let service: CacheService;
  let cacheManager: Cache;
  let metricsService: CacheMetricsService;

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        CacheMetricsService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
    metricsService = module.get<CacheMetricsService>(CacheMetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return cached value on hit', async () => {
      const key = 'test-key';
      const value = { data: 'test' };
      mockCacheManager.get.mockResolvedValue(value);

      const result = await service.get(key);

      expect(result).toEqual(value);
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
    });

    it('should return undefined on miss', async () => {
      const key = 'test-key';
      mockCacheManager.get.mockResolvedValue(undefined);

      const result = await service.get(key);

      expect(result).toBeUndefined();
    });

    it('should handle errors gracefully', async () => {
      const key = 'test-key';
      mockCacheManager.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.get(key);

      expect(result).toBeUndefined();
    });
  });

  describe('set', () => {
    it('should set value in cache', async () => {
      const key = 'test-key';
      const value = { data: 'test' };
      mockCacheManager.set.mockResolvedValue(undefined);

      await service.set(key, value);

      expect(mockCacheManager.set).toHaveBeenCalledWith(
        key,
        value,
        expect.any(Number),
      );
    });

    it('should handle errors gracefully', async () => {
      const key = 'test-key';
      const value = { data: 'test' };
      mockCacheManager.set.mockRejectedValue(new Error('Redis error'));

      await expect(service.set(key, value)).resolves.not.toThrow();
    });
  });

  describe('del', () => {
    it('should delete key from cache', async () => {
      const key = 'test-key';
      mockCacheManager.del.mockResolvedValue(undefined);

      await service.del(key);

      expect(mockCacheManager.del).toHaveBeenCalledWith(key);
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      const key = 'test-key';
      const cachedValue = { data: 'cached' };
      mockCacheManager.get.mockResolvedValue(cachedValue);
      const factory = jest.fn();

      const result = await service.getOrSet(key, factory);

      expect(result).toEqual(cachedValue);
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result on miss', async () => {
      const key = 'test-key';
      const newValue = { data: 'new' };
      mockCacheManager.get.mockResolvedValue(undefined);
      mockCacheManager.set.mockResolvedValue(undefined);
      const factory = jest.fn().mockResolvedValue(newValue);

      const result = await service.getOrSet(key, factory);

      expect(result).toEqual(newValue);
      expect(factory).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });

  describe('metrics', () => {
    it('should record cache hit', async () => {
      const key = 'test-key';
      mockCacheManager.get.mockResolvedValue({ data: 'test' });
      const recordHitSpy = jest.spyOn(metricsService, 'recordHit');

      await service.get(key);

      expect(recordHitSpy).toHaveBeenCalled();
    });

    it('should record cache miss', async () => {
      const key = 'test-key';
      mockCacheManager.get.mockResolvedValue(undefined);
      const recordMissSpy = jest.spyOn(metricsService, 'recordMiss');

      await service.get(key);

      expect(recordMissSpy).toHaveBeenCalled();
    });
  });
});
