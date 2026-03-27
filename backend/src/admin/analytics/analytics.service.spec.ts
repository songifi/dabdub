import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CacheService } from '../../../cache/cache.service';
import { AnalyticsService } from './analytics.service';
import { User } from '../../users/entities/user.entity';
import { Transaction, TransactionStatus } from '../../../transactions/entities/transaction.entity';
import { WaitlistEntry } from '../../../waitlist/entities/waitlist-entry.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockUserRepo: jest.Mocked<Repository<User>>;
  let mockTxRepo: jest.Mocked<Repository<Transaction>>;
  let mockWaitlistRepo: jest.Mocked<Repository<WaitlistEntry>>;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(User),
          useValue: { count: jest.fn(), createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(WaitlistEntry),
          useValue: { count: jest.fn() },
        },
        {
          provide: CacheService,
          useValue: { get: jest.fn(), set: jest.fn(), getActiveUsersTodayCount: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    mockUserRepo = module.get(getRepositoryToken(User));
    mockTxRepo = module.get(getRepositoryToken(Transaction));
    mockWaitlistRepo = module.get(getRepositoryToken(WaitlistEntry));
    mockCache = module.get(CacheService);
  });

  it('should compute conversion funnel percentages correctly', async () => {
    mockWaitlistRepo.count.mockResolvedValue(100);
    mockUserRepo.count.mockImplementation((options) => {
      if (options.where.emailVerified) return Promise.resolve(80);
      if (options.where['pinHash IS NOT NULL']) return Promise.resolve(60);
      return Promise.resolve(100);
    });
    // First tx count
    mockUserRepo.createQueryBuilder().innerJoin.mockReturnThis();
    mockUserRepo.createQueryBuilder().where.mockReturnThis();
    mockUserRepo.createQueryBuilder().groupBy.mockReturnThis();
    mockUserRepo.createQueryBuilder().getCount.mockResolvedValue(40);

    const result = await service.getConversionFunnel();

    expect(result.stages.length).toBe(5);
    expect(result.stages[0].percent).toBe(100);
    expect(result.stages[4].percent).toBe(40);
    expect(result.total).toBe(100);
  });

  it('should return correct number of data points for growth', async () => {
    const days = 7;
    mockUserRepo.createQueryBuilder()
      .getRawMany.mockResolvedValue(Array(days).fill({ date: '2024-01-01', newusers: 10 }));

    const result = await service.getUserGrowth(days);

    expect(result.data.length).toBe(days);
  });

  it('should use cache if available', async () => {
    const mockData = { totalUsers: 100 };
    mockCache.get.mockResolvedValue(mockData);

    const result = await service.getDashboardStats();

    expect(result).toBe(mockData);
    expect(mockUserRepo.count).not.toHaveBeenCalled();
  });
});

