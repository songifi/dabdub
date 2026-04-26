import { Test, TestingModule } from '@nestjs/testing';
import { RatesService, RATE_CACHE_KEY, RATE_TTL_SECONDS } from './rates.service';
import { CacheService } from '../cache/cache.service';
import { StellarService } from '../stellar/stellar.service';

const mockCache = {
  getOrSet: jest.fn(),
  set: jest.fn(),
};

const mockStellar = {
  getXlmUsdRate: jest.fn(),
};

describe('RatesService', () => {
  let service: RatesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatesService,
        { provide: CacheService, useValue: mockCache },
        { provide: StellarService, useValue: mockStellar },
      ],
    }).compile();
    service = module.get(RatesService);
  });

  describe('getXlmUsdRate', () => {
    it('returns cached rate on cache hit', async () => {
      mockCache.getOrSet.mockResolvedValue({ value: 0.12, cacheHit: true });
      const rate = await service.getXlmUsdRate();
      expect(rate).toBe(0.12);
      expect(mockCache.getOrSet).toHaveBeenCalledWith(
        RATE_CACHE_KEY,
        expect.any(Function),
        { ttlSeconds: RATE_TTL_SECONDS },
      );
    });

    it('fetches fresh rate on cache miss', async () => {
      mockStellar.getXlmUsdRate.mockResolvedValue(0.15);
      mockCache.getOrSet.mockImplementation(async (_key, fetchFn, _opts) => ({
        value: await fetchFn(),
        cacheHit: false,
      }));
      const rate = await service.getXlmUsdRate();
      expect(rate).toBe(0.15);
      expect(mockStellar.getXlmUsdRate).toHaveBeenCalled();
    });
  });

  describe('fetchAndCache', () => {
    it('fetches from stellar and writes to cache with 30s TTL', async () => {
      mockStellar.getXlmUsdRate.mockResolvedValue(0.2);
      mockCache.set.mockResolvedValue(undefined);
      const rate = await service.fetchAndCache();
      expect(rate).toBe(0.2);
      expect(mockCache.set).toHaveBeenCalledWith(RATE_CACHE_KEY, 0.2, { ttlSeconds: RATE_TTL_SECONDS });
    });
  });
});
