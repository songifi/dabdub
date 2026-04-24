import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { MerchantAnalyticsService } from './merchant-analytics.service';

describe('MerchantAnalyticsService', () => {
  it('fills missing signup days and computes activation and monthly actives', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { day: '2026-04-20', count: '2' },
        { day: '2026-04-22', count: '1' },
      ])
      .mockResolvedValueOnce([{ count: '3', total: '5' }])
      .mockResolvedValueOnce([{ count: '4' }]);

    const mockCache = {
      getParsed: jest.fn().mockResolvedValue(null),
      setParsed: jest.fn().mockResolvedValue(undefined),
    };

    const service = new MerchantAnalyticsService({ query } as never, mockCache as never);

    const result = await service.getMetrics(new Date('2026-04-22T10:00:00.000Z'));

    expect(mockCache.setParsed).toHaveBeenCalledWith(
      'admin',
      'merchants',
      '2026-04-22',
      'admin',
      expect.objectContaining({
        generatedAt: '2026-04-22T10:00:00.000Z',
      }),
    );

    expect(result.generatedAt).toBe('2026-04-22T10:00:00.000Z');
    expect(result.dailySignups).toHaveLength(30);
    expect(result.dailySignups.at(-3)).toEqual({
      date: '2026-04-20',
      signups: 2,
    });
    expect(result.dailySignups.at(-2)).toEqual({
      date: '2026-04-21',
      signups: 0,
    });
    expect(result.dailySignups.at(-1)).toEqual({
      date: '2026-04-22',
      signups: 1,
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

  it('returns cached admin metrics without querying DB', async () => {
    const cached = {
      generatedAt: 'cached',
      dailySignups: [],
      activationRate: {
        windowDays: 7,
        activatedMerchants: 0,
        totalMerchants: 0,
        percentage: 0,
      },
      monthlyActiveMerchants: { month: '2026-01', count: 0 },
    };
    const query = jest.fn();
    const mockCache = {
      getParsed: jest.fn().mockResolvedValue(cached),
      setParsed: jest.fn(),
    };
    const service = new MerchantAnalyticsService({ query } as never, mockCache as never);

    const result = await service.getMetrics(new Date('2026-01-15T12:00:00.000Z'));

    expect(result).toBe(cached);
    expect(query).not.toHaveBeenCalled();
    expect(mockCache.setParsed).not.toHaveBeenCalled();
  });
});
