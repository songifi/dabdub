import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryCacheService } from './analytics-query-cache.service';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { SettlementStatus, Settlement } from '../settlements/entities/settlement.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let queryCache: AnalyticsQueryCacheService;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        AnalyticsQueryCacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
          },
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: paymentRepoMock,
        },
        {
          provide: getRepositoryToken(Settlement),
          useValue: settlementRepoMock,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    queryCache = module.get<AnalyticsQueryCacheService>(AnalyticsQueryCacheService);
    service.clearCache();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getVolume', () => {
    it('should return aggregated volume series and hit cache on repeat', async () => {
      paymentQueryBuilder.getRawMany.mockResolvedValueOnce([
        { bucket: '2026-04-20', count: '1', volumeUsd: '100' },
        { bucket: '2026-04-21', count: '1', volumeUsd: '200' },
      ]);

      const result1 = await service.getVolume({
        scope: 'merchant',
        merchantId: mockMerchantId,
        period: 'daily',
        dateFrom: '2026-04-20',
        dateTo: '2026-04-21',
      });
      expect(Array.isArray(result1)).toBe(true);
      expect(result1.length).toBeGreaterThan(0);
      expect(paymentQueryBuilder.getRawMany).toHaveBeenCalledTimes(1);

      const result2 = await service.getVolume({
        scope: 'merchant',
        merchantId: mockMerchantId,
        period: 'daily',
        dateFrom: '2026-04-20',
        dateTo: '2026-04-21',
      });
      expect(result2).toEqual(result1);
      expect(paymentQueryBuilder.getRawMany).toHaveBeenCalledTimes(1);
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

      expect(result.cacheHit).toBe(false);
      expect('counts' in result && result.counts.settled).toBe(10);
      expect('counts' in result && result.counts.total).toBe(20);
      expect('percentages' in result && result.percentages.conversionRate).toBe(50);
      expect('percentages' in result && result.percentages.abandonmentRate).toBe(25);
    });

    it('should handle zero records', async () => {
      paymentQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getFunnel(mockMerchantId);

      expect('counts' in result && result.counts.total).toBe(0);
      expect('percentages' in result && result.percentages.conversionRate).toBe(0);
      expect('percentages' in result && result.percentages.abandonmentRate).toBe(0);
    });
  });

  describe('getComparison', () => {
    it('should compare periods correctly including zero-previous case', async () => {
      paymentQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '150' })
        .mockResolvedValueOnce({ total: '0' });

      const result = await service.getComparison(mockMerchantId, 'daily');

      expect(result.cacheHit).toBe(false);
      expect(result.currentPeriod.volume).toBe(150);
      expect(result.previousPeriod.volume).toBe(0);
      expect(result.growth).toBe(100);
    });

    it('should handle negative growth', async () => {
      paymentQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '100' })
        .mockResolvedValueOnce({ total: '200' });

      const result = await service.getComparison(mockMerchantId, 'daily');

      expect(result.growth).toBe(-50);
    });

    it('should handle monthly comparison', async () => {
      paymentQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '1000' })
        .mockResolvedValueOnce({ total: '800' });

      const result = await service.getComparison(mockMerchantId, 'monthly');

      expect(result.growth).toBe(25);
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

      expect(result.cacheHit).toBe(false);
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

  describe('cache invalidation on settlement', () => {
    it('should clear merchant and admin keys after invalidateAfterPaymentSettled', async () => {
      settlementQueryBuilder.getRawMany.mockResolvedValue([
        { bucket: '2026-04-01', total: '1.000000', count: '1' },
      ]);
      settlementQueryBuilder.getRawOne.mockResolvedValue({ total: '1.000000' });

      await service.getRevenue({
        scope: 'merchant',
        merchantId: mockMerchantId,
        period: 'daily',
        from: '2026-04-01',
        to: '2026-04-01',
      });
      await service.getRevenue({
        scope: 'admin',
        period: 'daily',
        from: '2026-04-01',
        to: '2026-04-01',
      });

      await queryCache.invalidateAfterPaymentSettled(mockMerchantId);

      settlementQueryBuilder.getRawMany.mockClear();
      settlementQueryBuilder.getRawOne.mockClear();
      settlementQueryBuilder.getRawMany.mockResolvedValue([
        { bucket: '2026-04-01', total: '2.000000', count: '2' },
      ]);
      settlementQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '2.000000' })
        .mockResolvedValueOnce({ total: '0.000000' });

      const after = await service.getRevenue({
        scope: 'merchant',
        merchantId: mockMerchantId,
        period: 'daily',
        from: '2026-04-01',
        to: '2026-04-01',
      });

      expect(after.cacheHit).toBe(false);
      expect(after.currentPeriod.totalFeeRevenueUsd).toBe('2.000000');
      expect(settlementQueryBuilder.getRawMany).toHaveBeenCalled();
    });
  });
});
