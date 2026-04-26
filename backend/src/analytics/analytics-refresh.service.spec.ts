import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsRefreshService } from './analytics-refresh.service';
import { DailyPaymentVolume } from './entities/daily-payment-volume.view';
import { CronJobService } from '../cron/cron-job.service';

const mockViewRepo = { query: jest.fn() };
const mockCronJobService = {
  run: jest.fn((name: string, fn: () => Promise<void>) => fn()),
};

describe('AnalyticsRefreshService', () => {
  let service: AnalyticsRefreshService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsRefreshService,
        { provide: getRepositoryToken(DailyPaymentVolume), useValue: mockViewRepo },
        { provide: CronJobService, useValue: mockCronJobService },
      ],
    }).compile();
    service = module.get(AnalyticsRefreshService);
  });

  it('issues REFRESH MATERIALIZED VIEW CONCURRENTLY via cron job service', async () => {
    mockViewRepo.query.mockResolvedValue(undefined);
    await service.refreshMaterializedViews();
    expect(mockCronJobService.run).toHaveBeenCalledWith(
      'refresh-mv-daily-payment-volume',
      expect.any(Function),
    );
    expect(mockViewRepo.query).toHaveBeenCalledWith(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_payment_volume',
    );
  });
});
