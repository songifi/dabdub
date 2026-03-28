import { Test, TestingModule } from '@nestjs/testing';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import type { SecurityOverviewDto } from './dto/security.dto';

describe('SecurityController', () => {
  let controller: SecurityController;
  let service: jest.Mocked<SecurityService>;

  const mockRequest = {
    user: { id: 'user-123', username: 'testuser' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecurityController],
      providers: [
        {
          provide: SecurityService,
          useValue: {
            getOverview: jest.fn(),
            getLoginHistory: jest.fn(),
            getUnreadAlerts: jest.fn(),
            markAlertAsRead: jest.fn(),
            getTrustedDevices: jest.fn(),
            revokeTrustedDevice: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SecurityController>(SecurityController);
    service = module.get(SecurityService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getOverview', () => {
    it('should return security overview', async () => {
      const mockOverview: SecurityOverviewDto = {
        securityScore: 80,
        emailVerified: true,
        phoneVerified: true,
        hasPin: true,
        hasPasskey: false,
        kycStatus: 'approved' as any,
        activeSessions: 2,
        trustedDevices: 3,
        lastLoginAt: '2024-03-26T10:00:00Z',
        lastLoginIp: '192.168.1.1',
        recentAlerts: [],
      };

      service.getOverview.mockResolvedValue(mockOverview);

      const result = await controller.getOverview(mockRequest as any);

      expect(result).toEqual(mockOverview);
      expect(service.getOverview).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getLoginHistory', () => {
    it('should return paginated login history', async () => {
      const mockResult = {
        data: [
          { id: '1', ipAddress: '192.168.1.1', status: 'success', createdAt: '2024-03-26T10:00:00Z' },
        ],
        total: 50,
        page: 1,
        limit: 20,
        hasMore: true,
      };

      service.getLoginHistory.mockResolvedValue({
        data: mockResult.data as any,
        total: 50,
        page: 1,
        limit: 20,
      });

      const result = await controller.getLoginHistory(mockRequest as any, 1, 20);

      expect(result.data.length).toBe(1);
      expect(result.total).toBe(50);
      expect(result.hasMore).toBe(true);
      expect(service.getLoginHistory).toHaveBeenCalledWith('user-123', 1, 20);
    });
  });

  describe('getAlerts', () => {
    it('should return paginated alerts', async () => {
      const mockResult = {
        data: [
          { id: 'alert-1', type: 'new_device', message: 'New device login', isRead: false, createdAt: '2024-03-26T10:00:00Z' },
        ],
        total: 5,
        page: 1,
        limit: 20,
      };

      service.getUnreadAlerts.mockResolvedValue({
        data: mockResult.data as any,
        total: 5,
        page: 1,
        limit: 20,
      });

      const result = await controller.getAlerts(mockRequest as any, 1, 20);

      expect(result.data.length).toBe(1);
      expect(result.total).toBe(5);
      expect(service.getUnreadAlerts).toHaveBeenCalledWith('user-123', 1, 20);
    });
  });

  describe('markAlertAsRead', () => {
    it('should mark alert as read', async () => {
      service.markAlertAsRead.mockResolvedValue(undefined);

      await controller.markAlertAsRead(mockRequest as any, 'alert-123');

      expect(service.markAlertAsRead).toHaveBeenCalledWith('user-123', 'alert-123');
    });
  });

  describe('getTrustedDevices', () => {
    it('should return paginated trusted devices', async () => {
      const mockResult = {
        data: [
          { id: 'device-1', deviceName: 'iPhone', lastSeenAt: '2024-03-26T10:00:00Z', createdAt: '2024-03-20T10:00:00Z' },
        ],
        total: 3,
        page: 1,
        limit: 20,
      };

      service.getTrustedDevices.mockResolvedValue({
        data: mockResult.data as any,
        total: 3,
        page: 1,
        limit: 20,
      });

      const result = await controller.getTrustedDevices(mockRequest as any, 1, 20);

      expect(result.data.length).toBe(1);
      expect(result.total).toBe(3);
      expect(service.getTrustedDevices).toHaveBeenCalledWith('user-123', 1, 20);
    });
  });

  describe('revokeTrustedDevice', () => {
    it('should revoke trusted device', async () => {
      service.revokeTrustedDevice.mockResolvedValue(undefined);

      await controller.revokeTrustedDevice(mockRequest as any, 'device-123');

      expect(service.revokeTrustedDevice).toHaveBeenCalledWith('user-123', 'device-123');
    });
  });
});
