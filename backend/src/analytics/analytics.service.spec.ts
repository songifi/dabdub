import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from './analytics.service';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { Repository } from 'typeorm';
import { AnalyticsCacheService } from '../cache/analytics-cache.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let analyticsCache: AnalyticsCacheService;

  const mockMerchantId = 'merchant-123';

  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
  };

  const mockRepo = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  beforeEach(async () => {
    analyticsCache = new AnalyticsCacheService({
      get: (key: string, def?: unknown) => {
        if (key === 'ANALYTICS_CACHE_MIN_COMPRESS_BYTES') return 32;
        return def;
      },
    } as unknown as ConfigService);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockRepo,
        },
        { provide: AnalyticsCacheService, useValue: analyticsCache },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    analyticsCache.clearAllForTesting();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getVolume', () => {
    it('should return aggregated volume data and test cache', async () => {
      const mockData = [
        { date: '2026-04-20', volume: '100', count: '1' },
        { date: '2026-04-21', volume: '200', count: '1' },
      ];
      mockQueryBuilder.getRawMany.mockResolvedValueOnce(mockData);

      const result1 = await service.getVolume(mockMerchantId, 'daily');
      expect(result1.results).toEqual(mockData);
      expect(result1.cacheHit).toBe(false);

      const result2 = await service.getVolume(mockMerchantId, 'daily');
      expect(result2.results).toEqual(mockData);
      expect(result2.cacheHit).toBe(true);

      expect(mockQueryBuilder.getRawMany).toHaveBeenCalledTimes(1);
    });

    it('second hit is fast (cache path, no extra DB aggregation)', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([{ date: '2026-04-20', volume: '1', count: '1' }]);
      await service.getVolume('merchant-fast', 'daily');
      const t0 = process.hrtime.bigint();
      await service.getVolume('merchant-fast', 'daily');
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      expect(ms).toBeLessThan(20);
      expect(mockQueryBuilder.getRawMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFunnel', () => {
    it('should calculate funnel metrics correctly', async () => {
      const mockStats = [
        { status: PaymentStatus.SETTLED, count: '10' },
        { status: PaymentStatus.PENDING, count: '5' },
        { status: PaymentStatus.FAILED, count: '2' },
        { status: PaymentStatus.EXPIRED, count: '3' },
      ];
      mockQueryBuilder.getRawMany.mockResolvedValueOnce(mockStats);

      const result = await service.getFunnel(mockMerchantId);

      expect(result.counts.settled).toBe(10);
      expect(result.counts.total).toBe(20);
      expect(result.percentages.conversionRate).toBe(50);
      expect(result.percentages.abandonmentRate).toBe(25);
    });

    it('should handle zero records', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getFunnel(mockMerchantId);

      expect(result.counts.total).toBe(0);
      expect(result.percentages.conversionRate).toBe(0);
      expect(result.percentages.abandonmentRate).toBe(0);
    });
  });

  describe('getComparison', () => {
    it('should compare periods correctly including zero-previous case', async () => {
      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '150' })
        .mockResolvedValueOnce({ total: '0' });

      const result = await service.getComparison(mockMerchantId, 'daily');

      expect(result.currentPeriod.volume).toBe(150);
      expect(result.previousPeriod.volume).toBe(0);
      expect(result.growth).toBe(100);
      expect(result.currentPeriod.start).toBeInstanceOf(Date);
    });

    it('should handle negative growth', async () => {
      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '100' })
        .mockResolvedValueOnce({ total: '200' });

      const result = await service.getComparison(mockMerchantId, 'daily');

      expect(result.growth).toBe(-50);
    });

    it('should handle monthly comparison', async () => {
      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '1000' })
        .mockResolvedValueOnce({ total: '800' });

      const result = await service.getComparison(mockMerchantId, 'monthly');

      expect(result.growth).toBe(25);
    });

    it('caches comparison and revives Date fields on hit', async () => {
      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '10' })
        .mockResolvedValueOnce({ total: '5' });

      const r1 = await service.getComparison(mockMerchantId, 'daily');
      expect(r1.cacheHit).toBe(false);
      const r2 = await service.getComparison(mockMerchantId, 'daily');
      expect(r2.cacheHit).toBe(true);
      expect(r2.currentPeriod.start).toBeInstanceOf(Date);
      expect(mockQueryBuilder.getRawOne).toHaveBeenCalledTimes(2);
    });
  });
});
