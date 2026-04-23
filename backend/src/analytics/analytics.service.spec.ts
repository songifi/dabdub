import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { Repository } from 'typeorm';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let repo: Repository<Payment>;

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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    repo = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    service.clearCache();
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

      // First call - Cache miss
      const result1 = await service.getVolume(mockMerchantId, 'daily');
      expect(result1.results).toEqual(mockData);
      expect(result1.cacheHit).toBe(false);

      // Second call - Cache hit
      const result2 = await service.getVolume(mockMerchantId, 'daily');
      expect(result2.results).toEqual(mockData);
      expect(result2.cacheHit).toBe(true);
      
      // Ensure query builder was only called once
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
      // Mock current period volume
      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '150' }) // current
        .mockResolvedValueOnce({ total: '0' });   // previous

      const result = await service.getComparison(mockMerchantId, 'daily');
      
      expect(result.currentPeriod.volume).toBe(150);
      expect(result.previousPeriod.volume).toBe(0);
      expect(result.growth).toBe(100); // 100% growth from 0
    });

    it('should handle negative growth', async () => {
      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '100' }) // current
        .mockResolvedValueOnce({ total: '200' }); // previous

      const result = await service.getComparison(mockMerchantId, 'daily');
      
      expect(result.growth).toBe(-50);
    });

    it('should handle monthly comparison', async () => {
      mockQueryBuilder.getRawOne
        .mockResolvedValueOnce({ total: '1000' }) // current month
        .mockResolvedValueOnce({ total: '800' });  // previous month

      const result = await service.getComparison(mockMerchantId, 'monthly');
      
      expect(result.growth).toBe(25);
    });
  });
});
