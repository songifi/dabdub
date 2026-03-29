import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MaintenanceWindowMiddleware } from './maintenance-window.middleware';
import { MaintenanceService } from '../maintenance.service';
import { MaintenanceWindow, MaintenanceStatus } from '../entities/maintenance-window.entity';

describe('MaintenanceWindowMiddleware', () => {
  let middleware: MaintenanceWindowMiddleware;
  let maintenanceService: jest.Mocked<MaintenanceService>;
  let mockRequest: Partial<Request & { user?: { id?: string; role?: string } }>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  const mockActiveWindow: MaintenanceWindow = {
    id: 'test-id',
    title: 'System Maintenance',
    description: 'Upgrading payment system',
    startAt: new Date(),
    endAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
    affectedServices: ['transfers'],
    status: MaintenanceStatus.ACTIVE,
    createdBy: 'admin-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceWindowMiddleware,
        {
          provide: MaintenanceService,
          useValue: {
            getActive: jest.fn(),
          },
        },
      ],
    }).compile();

    middleware = module.get<MaintenanceWindowMiddleware>(MaintenanceWindowMiddleware);
    maintenanceService = module.get(MaintenanceService);

    mockRequest = {
      path: '/api/v1/transfers',
      user: undefined,
    };
    mockResponse = {};
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('admin bypass', () => {
    it('should allow admin users to bypass maintenance', async () => {
      mockRequest.user = { id: 'admin-id', role: 'admin' };
      maintenanceService.getActive.mockResolvedValue([mockActiveWindow]);

      await middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(maintenanceService.getActive).not.toHaveBeenCalled();
    });

    it('should allow super_admin JWT users to bypass maintenance', async () => {
      mockRequest.user = { id: 'sa-id', role: 'super_admin' };
      maintenanceService.getActive.mockResolvedValue([mockActiveWindow]);

      await middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(maintenanceService.getActive).not.toHaveBeenCalled();
    });

    it('should allow admin-console superadmin role to bypass maintenance', async () => {
      mockRequest.user = { id: 'admin-console-id', role: 'superadmin' };
      maintenanceService.getActive.mockResolvedValue([mockActiveWindow]);

      await middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(maintenanceService.getActive).not.toHaveBeenCalled();
    });
  });

  describe('route exclusions', () => {
    it('should allow health check routes', async () => {
      mockRequest.path = '/health';
      maintenanceService.getActive.mockResolvedValue([mockActiveWindow]);

      await middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(maintenanceService.getActive).not.toHaveBeenCalled();
    });

    it('should allow admin routes', async () => {
      mockRequest.path = '/api/v1/admin/users';
      maintenanceService.getActive.mockResolvedValue([mockActiveWindow]);

      await middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(maintenanceService.getActive).not.toHaveBeenCalled();
    });

    it('should allow public system maintenance status route', async () => {
      mockRequest.path = '/api/v1/system/maintenance';
      maintenanceService.getActive.mockResolvedValue([mockActiveWindow]);

      await middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(maintenanceService.getActive).not.toHaveBeenCalled();
    });
  });

  describe('maintenance window blocking', () => {
    it('should block requests when service is affected', async () => {
      mockRequest.path = '/api/v1/transfers';
      maintenanceService.getActive.mockResolvedValue([mockActiveWindow]);

      await expect(
        middleware.use(mockRequest as any, mockResponse as any, mockNext)
      ).rejects.toThrow(ServiceUnavailableException);

      expect(maintenanceService.getActive).toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block all requests when "all" is in affected services', async () => {
      const allAffectedWindow = {
        ...mockActiveWindow,
        affectedServices: ['all'],
      };
      mockRequest.path = '/api/v1/users/profile';
      maintenanceService.getActive.mockResolvedValue([allAffectedWindow]);

      await expect(
        middleware.use(mockRequest as any, mockResponse as any, mockNext)
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should allow requests when service is not affected', async () => {
      mockRequest.path = '/api/v1/users/profile';
      maintenanceService.getActive.mockResolvedValue([mockActiveWindow]);

      await middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow requests when no active maintenance windows', async () => {
      mockRequest.path = '/api/v1/transfers';
      maintenanceService.getActive.mockResolvedValue([]);

      await middleware.use(mockRequest as any, mockResponse as any, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('service mapping', () => {
    const testCases = [
      { path: '/api/v1/transfers', service: 'transfers' },
      { path: '/api/v1/withdrawals', service: 'withdrawals' },
      { path: '/api/v1/bank-accounts', service: 'banking' },
      { path: '/api/v1/virtual-cards', service: 'cards' },
      { path: '/api/v1/paylink', service: 'paylinks' },
      { path: '/api/v1/merchants', service: 'merchants' },
      { path: '/api/v1/wallets', service: 'wallets' },
      { path: '/api/v1/auth', service: 'auth' },
    ];

    testCases.forEach(({ path, service }) => {
      it(`should block ${path} when ${service} is affected`, async () => {
        const affectedWindow = {
          ...mockActiveWindow,
          affectedServices: [service],
        };
        mockRequest.path = path;
        maintenanceService.getActive.mockResolvedValue([affectedWindow]);

        await expect(
          middleware.use(mockRequest as any, mockResponse as any, mockNext)
        ).rejects.toThrow(ServiceUnavailableException);
      });
    });
  });

  describe('error response format', () => {
    it('should throw ServiceUnavailableException with correct format', async () => {
      mockRequest.path = '/api/v1/transfers';
      maintenanceService.getActive.mockResolvedValue([mockActiveWindow]);

      try {
        await middleware.use(mockRequest as any, mockResponse as any, mockNext);
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceUnavailableException);
        expect(error.getResponse()).toEqual({
          code: 'MAINTENANCE',
          message: mockActiveWindow.title,
          description: mockActiveWindow.description,
          estimatedRestoration: mockActiveWindow.endAt,
          affectedServices: mockActiveWindow.affectedServices,
        });
      }
    });
  });
});