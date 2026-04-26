import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MerchantStatus, MerchantRole } from '../merchants/entities/merchant.entity';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { Reflector } from '@nestjs/core';

describe('AdminController', () => {
  let controller: AdminController;
  let service: AdminService;

  const mockAdminService = {
    findAllMerchants: jest.fn(),
    findOneMerchant: jest.fn(),
    updateMerchantStatus: jest.fn(),
    bulkUpdateMerchantStatus: jest.fn(),
    getGlobalStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAllMerchants', () => {
    it('should call service.findAllMerchants with default values', async () => {
      const result = { merchants: [], total: 0 };
      mockAdminService.findAllMerchants.mockResolvedValue(result);
      expect(await controller.findAllMerchants()).toBe(result);
      expect(service.findAllMerchants).toHaveBeenCalledWith(1, 20);
    });

    it('should call service.findAllMerchants with custom values', async () => {
      const result = { merchants: [], total: 0 };
      mockAdminService.findAllMerchants.mockResolvedValue(result);
      expect(await controller.findAllMerchants(2, 50)).toBe(result);
      expect(service.findAllMerchants).toHaveBeenCalledWith(2, 50);
    });
  });

  describe('findOneMerchant', () => {
    it('should call service.findOneMerchant', async () => {
      const result = { id: '1', email: 'test@test.com' };
      mockAdminService.findOneMerchant.mockResolvedValue(result);
      expect(await controller.findOneMerchant('1')).toBe(result);
      expect(service.findOneMerchant).toHaveBeenCalledWith('1');
    });
  });

  describe('updateStatus', () => {
    it('should call service.updateMerchantStatus', async () => {
      const result = { id: '1', status: MerchantStatus.ACTIVE };
      mockAdminService.updateMerchantStatus.mockResolvedValue(result);
      expect(await controller.updateStatus('1', MerchantStatus.ACTIVE)).toBe(result);
      expect(service.updateMerchantStatus).toHaveBeenCalledWith('1', MerchantStatus.ACTIVE);
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should call service.bulkUpdateMerchantStatus', async () => {
      const result = { success: ['1'], failed: [] };
      mockAdminService.bulkUpdateMerchantStatus.mockResolvedValue(result);
      expect(await controller.bulkUpdateStatus(['1'], MerchantStatus.ACTIVE)).toBe(result);
      expect(service.bulkUpdateMerchantStatus).toHaveBeenCalledWith(['1'], MerchantStatus.ACTIVE);
    });
  });

  describe('getStats', () => {
    it('should call service.getGlobalStats', async () => {
      const result = { payments: [], merchants: [] };
      mockAdminService.getGlobalStats.mockResolvedValue(result);
      expect(await controller.getStats()).toBe(result);
      expect(service.getGlobalStats).toHaveBeenCalled();
    });
  });
});
