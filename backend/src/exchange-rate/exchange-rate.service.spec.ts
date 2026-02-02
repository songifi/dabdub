import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeRateService } from './exchange-rate.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExchangeRate } from './exchange-rate.entity';
import { CoinbaseProvider } from './providers/coinbase.provider';
import { BinanceProvider } from './providers/binance.provider';
import { CoinGeckoProvider } from './providers/coingecko.provider';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

describe('ExchangeRateService', () => {
    let service: ExchangeRateService;
    let cacheManagerStr: any;
    let rateRepositoryStr: any;

    const mockCacheManager = {
        get: jest.fn(),
        set: jest.fn(),
    };

    const mockRateRepository = {
        save: jest.fn(),
    };

    const mockCoinbaseProvider = {
        name: 'Coinbase',
        getRate: jest.fn(),
    };

    const mockBinanceProvider = {
        name: 'Binance',
        getRate: jest.fn(),
    };

    const mockCoinGeckoProvider = {
        name: 'CoinGecko',
        getRate: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ExchangeRateService,
                { provide: CACHE_MANAGER, useValue: mockCacheManager },
                { provide: getRepositoryToken(ExchangeRate), useValue: mockRateRepository },
                { provide: CoinbaseProvider, useValue: mockCoinbaseProvider },
                { provide: BinanceProvider, useValue: mockBinanceProvider },
                { provide: CoinGeckoProvider, useValue: mockCoinGeckoProvider },
            ],
        }).compile();

        service = module.get<ExchangeRateService>(ExchangeRateService);
        cacheManagerStr = module.get(CACHE_MANAGER);
        rateRepositoryStr = module.get(getRepositoryToken(ExchangeRate));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getRate', () => {
        it('should return cached rate if available', async () => {
            mockCacheManager.get.mockResolvedValue(50000);
            const rate = await service.getRate('BTC-USD');
            expect(rate).toBe(50000);
            expect(mockCacheManager.get).toHaveBeenCalledWith('rate:BTC-USD');
            expect(mockCoinbaseProvider.getRate).not.toHaveBeenCalled();
        });

        it('should fetch and aggregate if not in cache', async () => {
            mockCacheManager.get.mockResolvedValue(null);
            mockCoinbaseProvider.getRate.mockResolvedValue(50000);
            mockBinanceProvider.getRate.mockResolvedValue(50100);
            mockCoinGeckoProvider.getRate.mockResolvedValue(49900);

            const rate = await service.getRate('BTC-USD');
            // 50000*0.4 + 50100*0.4 + 49900*0.2 = 20000 + 20040 + 9980 = 50020
            expect(rate).toBeCloseTo(50020, 4);
            expect(mockCacheManager.set).toHaveBeenCalledWith('rate:BTC-USD', expect.any(Number), 60000);
            expect(mockRateRepository.save).toHaveBeenCalled();
        });
    });

    describe('fetchAndAggregateRate', () => {
        it('should calculate average correctly', async () => {
            mockCoinbaseProvider.getRate.mockResolvedValue(100);
            mockBinanceProvider.getRate.mockResolvedValue(100);
            mockCoinGeckoProvider.getRate.mockResolvedValue(100);

            const rate = await service.fetchAndAggregateRate('BTC-USD');
            expect(rate).toBe(100);
        });

        it('should filter outliers', async () => {
            // Median 100. Limit 5% -> 95-105.
            mockCoinbaseProvider.getRate.mockResolvedValue(100);
            mockBinanceProvider.getRate.mockResolvedValue(101);
            mockCoinGeckoProvider.getRate.mockResolvedValue(150); // Outlier

            const rate = await service.fetchAndAggregateRate('BTC-USD');
            // Should exclude 150. Average of 100 and 101 is 100.5.
            expect(rate).toBe(100.5);
        });

        it('should handle one provider failure', async () => {
            mockCoinbaseProvider.getRate.mockResolvedValue(100);
            mockBinanceProvider.getRate.mockRejectedValue(new Error('API Error'));
            mockCoinGeckoProvider.getRate.mockResolvedValue(102);

            const rate = await service.fetchAndAggregateRate('BTC-USD');
            // Weights: Coinbase 0.4, CoinGecko 0.2. Total 0.6.
            // Sum: 100*0.4 + 102*0.2 = 40 + 20.4 = 60.4
            // Avg: 60.4 / 0.6 = 100.666...
            expect(rate).toBeCloseTo(100.67, 2);
        });

        it('should throw if all providers fail', async () => {
            mockCoinbaseProvider.getRate.mockRejectedValue(new Error('Fail'));
            mockBinanceProvider.getRate.mockRejectedValue(new Error('Fail'));
            mockCoinGeckoProvider.getRate.mockRejectedValue(new Error('Fail'));

            await expect(service.fetchAndAggregateRate('BTC-USD')).rejects.toThrow();
        });

        it('should calculate spread correctly', () => {
            const rates = [{ rate: 100 }, { rate: 110 }]; // 10% diff
            const spread = service.calculateSpread(rates as any);
            expect(spread).toBe(10);
        });

        it('should calculate confidence correctly', () => {
            // 3/3 providers, low spread
            expect(service.calculateConfidence(3, 3, 0.5)).toBe(1);

            // 2/3 providers, low spread
            expect(service.calculateConfidence(2, 3, 0.5)).toBeCloseTo(0.67, 2);

            // 3/3 providers, high spread (> 1%)
            expect(service.calculateConfidence(3, 3, 2.0)).toBeCloseTo(0.8);

            // 3/3 providers, very high spread (> 5%)
            expect(service.calculateConfidence(3, 3, 6.0)).toBeCloseTo(0.5); // 1 * 0.5
        });
    });
});
