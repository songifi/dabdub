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

    const service = new MerchantAnalyticsService({
      query,
    } as never);

    const result = await service.getMetrics(
      new Date('2026-04-22T10:00:00.000Z'),
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
    expect(result.activationRate).toEqual({
      windowDays: 7,
      activatedMerchants: 3,
      totalMerchants: 5,
      percentage: 60,
    });
    expect(result.monthlyActiveMerchants).toEqual({
      month: '2026-04',
      count: 4,
    });
  });
});
