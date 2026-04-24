import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { MerchantAnalyticsService } from './merchant-analytics.service';

describe('MerchantAnalyticsService - Payment Funnel', () => {
  let service: MerchantAnalyticsService;
  let mockDataSource: any;

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantAnalyticsService,
        {
          provide: getDataSourceToken(),
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<MerchantAnalyticsService>(MerchantAnalyticsService);
  });

  it('should calculate payment funnel correctly', async () => {
    // Mock database response
    mockDataSource.query.mockResolvedValue([
      {
        created: '100',
        confirmed: '80',
        settling: '70',
        settled: '65',
        failed: '15',
        expired: '5',
      },
    ]);

    const result = await service.getPaymentFunnel();

    expect(result.totalCreated).toBe(100);
    expect(result.stages).toHaveLength(4);
    
    // Check created stage
    expect(result.stages[0]).toEqual({
      stage: 'created',
      count: 100,
      percentage: 100,
    });

    // Check confirmed stage
    expect(result.stages[1]).toEqual({
      stage: 'confirmed',
      count: 80,
      percentage: 80,
      dropOffCount: 20,
      dropOffPercentage: 20,
    });

    // Check settling stage
    expect(result.stages[2]).toEqual({
      stage: 'settling',
      count: 70,
      percentage: 70,
      dropOffCount: 10,
      dropOffPercentage: 12.5,
    });

    // Check settled stage
    expect(result.stages[3]).toEqual({
      stage: 'settled',
      count: 65,
      percentage: 65,
      dropOffCount: 5,
      dropOffPercentage: 7.14,
    });
  });

  it('should handle network filter', async () => {
    mockDataSource.query.mockResolvedValue([
      {
        created: '50',
        confirmed: '40',
        settling: '35',
        settled: '30',
        failed: '8',
        expired: '2',
      },
    ]);

    const result = await service.getPaymentFunnel(
      '2024-01-01',
      '2024-01-31',
      'stellar'
    );

    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('AND p.network = $3'),
      expect.arrayContaining(['stellar'])
    );
    expect(result.network).toBe('stellar');
  });
});