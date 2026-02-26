import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FiatExchangeRateService } from './fiat-exchange-rate.service';
import { ExchangeRate } from './exchange-rate.entity';
import { CacheService } from '../cache/cache.service';
import {
  CoinGeckoFiatProvider,
  OpenExchangeRatesProvider,
} from './providers/fiat-rate.provider';

describe('FiatExchangeRateService', () => {
  let service: FiatExchangeRateService;
  let cacheService: jest.Mocked<CacheService>;
  let rateRepository: jest.Mocked<Repository<ExchangeRate>>;
  let coinGeckoProvider: jest.Mocked<CoinGeckoFiatProvider>;
  let openExchangeRatesProvider: jest.Mocked<OpenExchangeRatesProvider>;

  beforeEach(async () => {
    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((data) => data),
    };

    const mockCoinGeckoProvider = {
      name: 'CoinGecko',
      getRate: jest.fn(),
    };

    const mockOpenExchangeRatesProvider = {
      name: 'OpenExchangeRates',
      getRate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FiatExchangeRateService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: getRepositoryToken(ExchangeRate),
          useValue: mockRepository,
        },
        {
          provide: CoinGeckoFiatProvider,
          useValue: mockCoinGeckoProvider,
        },
        {
          provide: OpenExchangeRatesProvider,
          useValue: mockOpenExchangeRatesProvider,
        },
      ],
    }).compile();

    service = module.get<FiatExchangeRateService>(FiatExchangeRateService);
    cacheService = module.get(CacheService);
    rateRepository = module.get(getRepositoryToken(ExchangeRate));
    coinGeckoProvider = module.get(CoinGeckoFiatProvider);
    openExchangeRatesProvider = module.get(OpenExchangeRatesProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRate', () => {
    it('should return 1.0 for same currency', async () => {
      const result = await service.getRate('USD', 'USD');

      expect(result).toEqual({
        rate: 1.0,
        fromCache: false,
        isStale: false,
      });
      expect(cacheService.get).not.toHaveBeenCalled();
    });

    it('should return fresh cached rate when available', async () => {
      const cachedData = {
        rate: 1.35,
        timestamp: Date.now() - 30000, // 30 seconds ago
      };
      cacheService.get.mockResolvedValue(cachedData);

      const result = await service.getRate('USD', 'EUR');

      expect(result).toEqual({
        rate: 1.35,
        fromCache: true,
        isStale: false,
      });
      expect(cacheService.get).toHaveBeenCalledWith('fiat-rate:USD-EUR');
      expect(coinGeckoProvider.getRate).not.toHaveBeenCalled();
    });

    it('should return stale cached rate and revalidate in background', async () => {
      const cachedData = {
        rate: 1.35,
        timestamp: Date.now() - 90000, // 90 seconds ago (stale)
      };
      cacheService.get.mockResolvedValue(cachedData);
      coinGeckoProvider.getRate.mockResolvedValue(1.36);

      const result = await service.getRate('USD', 'EUR');

      expect(result).toEqual({
        rate: 1.35,
        fromCache: true,
        isStale: true,
      });

      // Wait a bit for background revalidation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(coinGeckoProvider.getRate).toHaveBeenCalledWith('USD', 'EUR');
    });

    it('should fetch from provider when cache misses', async () => {
      cacheService.get.mockResolvedValue(undefined);
      coinGeckoProvider.getRate.mockResolvedValue(1.35);

      const result = await service.getRate('USD', 'EUR');

      expect(result).toEqual({
        rate: 1.35,
        fromCache: false,
        isStale: false,
      });
      expect(coinGeckoProvider.getRate).toHaveBeenCalledWith('USD', 'EUR');
      expect(cacheService.set).toHaveBeenCalledWith(
        'fiat-rate:USD-EUR',
        expect.objectContaining({ rate: 1.35 }),
        { ttl: 60000 },
      );
      expect(rateRepository.save).toHaveBeenCalled();
    });

    it('should fallback to second provider if first fails', async () => {
      cacheService.get.mockResolvedValue(undefined);
      coinGeckoProvider.getRate.mockRejectedValue(
        new Error('Provider unavailable'),
      );
      openExchangeRatesProvider.getRate.mockResolvedValue(1.36);

      const result = await service.getRate('USD', 'EUR');

      expect(result).toEqual({
        rate: 1.36,
        fromCache: false,
        isStale: false,
      });
      expect(coinGeckoProvider.getRate).toHaveBeenCalled();
      expect(openExchangeRatesProvider.getRate).toHaveBeenCalled();
    });

    it('should fallback to database when all providers fail', async () => {
      cacheService.get.mockResolvedValue(undefined);
      coinGeckoProvider.getRate.mockRejectedValue(new Error('Failed'));
      openExchangeRatesProvider.getRate.mockRejectedValue(new Error('Failed'));

      const dbRate = {
        pair: 'USD-EUR',
        rate: 1.34,
        timestamp: new Date(Date.now() - 120000), // 2 minutes ago
      };
      rateRepository.findOne.mockResolvedValue(dbRate as any);

      const result = await service.getRate('USD', 'EUR');

      expect(result).toEqual({
        rate: 1.34,
        fromCache: false,
        isStale: true,
      });
      expect(rateRepository.findOne).toHaveBeenCalledWith({
        where: { pair: 'USD-EUR' },
        order: { timestamp: 'DESC' },
      });
    });

    it('should throw error when no rate available from any source', async () => {
      cacheService.get.mockResolvedValue(undefined);
      coinGeckoProvider.getRate.mockRejectedValue(new Error('Failed'));
      openExchangeRatesProvider.getRate.mockRejectedValue(new Error('Failed'));
      rateRepository.findOne.mockResolvedValue(null);

      await expect(service.getRate('USD', 'EUR')).rejects.toThrow(
        'No rate available for USD/EUR from any source',
      );
    });

    it('should throw error for unsupported currency', async () => {
      await expect(service.getRate('USD', 'XYZ')).rejects.toThrow(
        'Unsupported currency: XYZ',
      );
    });

    it('should handle all supported currencies', async () => {
      const supportedCurrencies = service.getSupportedCurrencies();

      expect(supportedCurrencies).toEqual([
        'USD',
        'NGN',
        'EUR',
        'GBP',
        'KES',
        'GHS',
      ]);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate cache for currency pair', async () => {
      await service.invalidateCache('USD', 'EUR');

      expect(cacheService.del).toHaveBeenCalledWith('fiat-rate:USD-EUR');
    });
  });

  describe('cache TTL behavior', () => {
    it('should cache with 60 second TTL', async () => {
      cacheService.get.mockResolvedValue(undefined);
      coinGeckoProvider.getRate.mockResolvedValue(1.35);

      await service.getRate('USD', 'EUR');

      expect(cacheService.set).toHaveBeenCalledWith(
        'fiat-rate:USD-EUR',
        expect.objectContaining({
          rate: 1.35,
          timestamp: expect.any(Number),
        }),
        { ttl: 60000 },
      );
    });
  });

  describe('stale-while-revalidate', () => {
    it('should not revalidate if cache is fresh', async () => {
      const cachedData = {
        rate: 1.35,
        timestamp: Date.now() - 30000, // 30 seconds ago (fresh)
      };
      cacheService.get.mockResolvedValue(cachedData);

      await service.getRate('USD', 'EUR');

      expect(coinGeckoProvider.getRate).not.toHaveBeenCalled();
    });

    it('should not return stale cache if too old', async () => {
      const cachedData = {
        rate: 1.35,
        timestamp: Date.now() - 400000, // 6+ minutes ago (too stale)
      };
      cacheService.get.mockResolvedValue(cachedData);
      coinGeckoProvider.getRate.mockResolvedValue(1.37);

      const result = await service.getRate('USD', 'EUR');

      // Should fetch fresh instead of returning stale
      expect(result.fromCache).toBe(false);
      expect(result.rate).toBe(1.37);
    });
  });
});
