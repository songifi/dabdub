import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { MerchantAnalyticsService } from './merchant-analytics.service';
import { CacheService } from '../cache/cache.service';

describe('MerchantAnalyticsService', () => {
  let service: MerchantAnalyticsService;
  let mockDataSource: any;
  let cache: { getOrSet: jest.Mock };

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn(),
    };

    const store = new Map<string, unknown>();
    cache = {
      getOrSet: jest.fn(async (key: string, fetchFn: () => Promise<unknown>) => {
        if (store.has(key)) return { value: store.get(key), cacheHit: true };
        const value = await fetchFn();
        store.set(key, value);
        return { value, cacheHit: false };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantAnalyticsService,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
        {
          provide: CacheService,
          useValue: cache,
        },
      ],
    }).compile();

    service = module.get<MerchantAnalyticsService>(MerchantAnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTopMerchants', () => {
    it('should return top merchants with correct structure', async () => {
      const mockResults = [
        {
          businessName: 'Test Business 1',
          volume: '1000.50',
          paymentCount: 25,
          settlementCount: 5,
          country: 'US',
        },
        {
          businessName: 'Test Business 2',
          volume: '750.25',
          paymentCount: 20,
          settlementCount: 3,
          country: 'CA',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResults);

      const result = await service.getTopMerchants(10, '30d');

      expect(result).toEqual({
        merchants: [
          {
            businessName: 'Test Business 1',
            volume: 1000.5,
            paymentCount: 25,
            settlementCount: 5,
            country: 'US',
          },
          {
            businessName: 'Test Business 2',
            volume: 750.25,
            paymentCount: 20,
            settlementCount: 3,
            country: 'CA',
          },
        ],
        period: '30d',
        generatedAt: expect.any(String),
      });

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        expect.arrayContaining([expect.any(String), 10]),
      );
    });

    it('should handle different period values', async () => {
      mockDataSource.query.mockResolvedValue([]);

      await service.getTopMerchants(5, '7d');
      await service.getTopMerchants(5, '90d');

      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    });

    it('should cache results for 10 minutes', async () => {
      const mockResults = [
        {
          businessName: 'Test Business',
          volume: '1000.00',
          paymentCount: 10,
          settlementCount: 2,
          country: 'US',
        },
      ];

      mockDataSource.query.mockResolvedValue(mockResults);

      // First call
      const result1 = await service.getTopMerchants(10, '30d');
      // Second call with same parameters
      const result2 = await service.getTopMerchants(10, '30d');

      expect(result1).toEqual(result2);
      expect(mockDataSource.query).toHaveBeenCalledTimes(1); // Should only query once due to caching
    });
  });
});