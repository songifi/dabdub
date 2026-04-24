import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from './analytics.service';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { SettlementStatus, Settlement } from '../settlements/entities/settlement.entity';
import { Repository } from 'typeorm';
import { AnalyticsCacheService } from '../cache/analytics-cache.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let analyticsCache: AnalyticsCacheService;

  const mockMerchantId = 'merchant-123';

  const paymentQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
  };

  const settlementQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
  };

  const paymentRepoMock = {
    createQueryBuilder: jest.fn(() => paymentQueryBuilder),
  };

  const settlementRepoMock = {
    createQueryBuilder: jest.fn(() => settlementQueryBuilder),
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
          useValue: paymentRepoMock,
        },
        {
          provide: getRepositoryToken(Settlement),
          useValue: settlementRepoMock,
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
      paymentQueryBuilder.getRawMany.mockResolvedValueOnce(mockData);

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
      paymentQueryBuilder.getRawMany.mockResolvedValueOnce(mockStats);

      const result = await service.getFunnel(mockMerchantId);

      expect(result.counts.settled).toBe(10);
      expect(result.counts.total).toBe(20);
      expect(result.percentages.conversionRate).toBe(50);
      expect(result.percentages.abandonmentRate).toBe(25);
    });

    it('should handle zero records', async () => {
      paymentQueryBuilder.getRawMany.mockResolvedValueOnce([]);

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

  describe('getRevenue', () => {
    it('should return merchant revenue totals, comparison, and zero-filled daily breakdown', async () => {
      settlementQueryBuilder.getRawMany.mockResolvedValueOnce([
        { bucket: '2026-04-01', total: '1.500000', count: '1' },
        { bucket: '2026-04-03', total: '2.250000', count: '2' },
      ]);
      settlementQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '3.750000' })
        .mockResolvedValueOnce({ total: '1.500000' });

      const result = await service.getRevenue({
        scope: 'merchant',
        merchantId: mockMerchantId,
        period: 'daily',
        from: '2026-04-01',
        to: '2026-04-03',
      });

      expect(result.scope).toBe('merchant');
      expect(result.currentPeriod).toEqual({
        start: '2026-04-01',
        end: '2026-04-03',
        totalFeeRevenueUsd: '3.750000',
      });
      expect(result.previousPeriod).toEqual({
        start: '2026-03-29',
        end: '2026-03-31',
        totalFeeRevenueUsd: '1.500000',
      });
      expect(result.comparison).toEqual({
        absoluteChangeUsd: '2.250000',
        percentageChange: 150,
      });
      expect(result.breakdown).toEqual([
        { date: '2026-04-01', feeRevenueUsd: '1.500000', settlementCount: 1 },
        { date: '2026-04-02', feeRevenueUsd: '0.000000', settlementCount: 0 },
        { date: '2026-04-03', feeRevenueUsd: '2.250000', settlementCount: 2 },
      ]);
      expect(settlementQueryBuilder.where).toHaveBeenCalledWith(
        '"settlement"."status" = :status',
        { status: SettlementStatus.COMPLETED },
      );
      expect(settlementQueryBuilder.andWhere).toHaveBeenCalledWith(
        '"settlement"."merchantId" = :merchantId',
        { merchantId: mockMerchantId },
      );
    });

    it('should return admin monthly revenue without merchant filtering', async () => {
      settlementQueryBuilder.getRawMany.mockResolvedValueOnce([
        { bucket: '2026-01', total: '5.000000', count: '2' },
        { bucket: '2026-02', total: '7.500000', count: '3' },
      ]);
      settlementQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '12.500000' })
        .mockResolvedValueOnce({ total: '10.000000' });

      const result = await service.getRevenue({
        scope: 'admin',
        period: 'monthly',
        from: '2026-01-01',
        to: '2026-02-28',
      });

      expect(result.scope).toBe('admin');
      expect(result.currentPeriod).toEqual({
        start: '2026-01',
        end: '2026-02',
        totalFeeRevenueUsd: '12.500000',
      });
      expect(result.previousPeriod).toEqual({
        start: '2025-11',
        end: '2025-12',
        totalFeeRevenueUsd: '10.000000',
      });
      expect(result.comparison).toEqual({
        absoluteChangeUsd: '2.500000',
        percentageChange: 25,
      });
      expect(result.breakdown).toEqual([
        { date: '2026-01', feeRevenueUsd: '5.000000', settlementCount: 2 },
        { date: '2026-02', feeRevenueUsd: '7.500000', settlementCount: 3 },
      ]);
      expect(settlementQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        '"settlement"."merchantId" = :merchantId',
        expect.anything(),
      );
    });

    it('should cache revenue responses for identical requests', async () => {
      settlementQueryBuilder.getRawMany.mockResolvedValueOnce([
        { bucket: '2026-04-01', total: '1.500000', count: '1' },
      ]);
      settlementQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '1.500000' })
        .mockResolvedValueOnce({ total: '0.000000' });

      const first = await service.getRevenue({
        scope: 'merchant',
        merchantId: mockMerchantId,
        period: 'daily',
        from: '2026-04-01',
        to: '2026-04-01',
      });
      const second = await service.getRevenue({
        scope: 'merchant',
        merchantId: mockMerchantId,
        period: 'daily',
        from: '2026-04-01',
        to: '2026-04-01',
      });

      expect(first.cacheHit).toBe(false);
      expect(second.cacheHit).toBe(true);
      expect(settlementQueryBuilder.getRawMany).toHaveBeenCalledTimes(1);
      expect(settlementQueryBuilder.getRawOne).toHaveBeenCalledTimes(2);
    });
  });
});
