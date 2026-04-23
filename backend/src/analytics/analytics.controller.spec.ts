import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: AnalyticsService;

  const mockAnalyticsService = {
    getVolume: jest.fn(),
    getFunnel: jest.fn(),
    getComparison: jest.fn(),
  };

  const mockReq = {
    user: {
      merchantId: 'merchant-123',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getVolume', () => {
    it('should call service.getVolume', async () => {
      const result = { results: [], cacheHit: false };
      mockAnalyticsService.getVolume.mockResolvedValue(result);

      expect(await controller.getVolume(mockReq, 'daily')).toBe(result);
      expect(service.getVolume).toHaveBeenCalledWith('merchant-123', 'daily');
    });
  });

  describe('getFunnel', () => {
    it('should call service.getFunnel', async () => {
      const result = { counts: {}, percentages: {}, cacheHit: false };
      mockAnalyticsService.getFunnel.mockResolvedValue(result);

      expect(await controller.getFunnel(mockReq)).toBe(result);
      expect(service.getFunnel).toHaveBeenCalledWith('merchant-123');
    });
  });

  describe('getComparison', () => {
    it('should call service.getComparison', async () => {
      const result = { growth: 0, cacheHit: false };
      mockAnalyticsService.getComparison.mockResolvedValue(result);

      expect(await controller.getComparison(mockReq, 'monthly')).toBe(result);
      expect(service.getComparison).toHaveBeenCalledWith('merchant-123', 'monthly');
    });
  });
});
