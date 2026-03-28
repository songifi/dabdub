import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecurityService } from './security.service';
import { LoginHistory, LoginStatus, LoginFailureReason, SecurityAlert, SecurityAlertType, TrustedDevice } from './entities';
import { User, KycStatus } from '../users/entities/user.entity';
import { Session } from '../auth/entities/session.entity';

describe('SecurityService', () => {
  let service: SecurityService;
  let userRepo: jest.Mocked<Repository<User>>;
  let loginHistoryRepo: jest.Mocked<Repository<LoginHistory>>;
  let alertRepo: jest.Mocked<Repository<SecurityAlert>>;
  let deviceRepo: jest.Mocked<Repository<TrustedDevice>>;
  let sessionRepo: jest.Mocked<Repository<Session>>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    emailVerified: true,
    phoneVerified: true,
    phone: '+1234567890',
    pinHash: 'hashed-pin',
    passkeyId: 'passkey-123',
    kycStatus: KycStatus.APPROVED,
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LoginHistory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SecurityAlert),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findAndCount: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TrustedDevice),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            count: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Session),
          useValue: {
            count: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
    userRepo = module.get(getRepositoryToken(User));
    loginHistoryRepo = module.get(getRepositoryToken(LoginHistory));
    alertRepo = module.get(getRepositoryToken(SecurityAlert));
    deviceRepo = module.get(getRepositoryToken(TrustedDevice));
    sessionRepo = module.get(getRepositoryToken(Session));
  });

  describe('getSecurityScore', () => {
    it('should calculate security score of 100 for fully secured account', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);

      const score = await service.getSecurityScore('user-123');

      expect(score).toBe(100);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-123' } });
    });

    it('should increment score by 20 for email verified', async () => {
      const user = { ...mockUser, emailVerified: true, phoneVerified: false, pinHash: null, passkeyId: null, kycStatus: KycStatus.NONE } as User;
      userRepo.findOne.mockResolvedValue(user);

      const score = await service.getSecurityScore('user-123');

      expect(score).toBe(20);
    });

    it('should increment score by 20 for phone verified', async () => {
      const user = { ...mockUser, emailVerified: false, phoneVerified: true, phone: '+1234567890', pinHash: null, passkeyId: null, kycStatus: KycStatus.NONE } as User;
      userRepo.findOne.mockResolvedValue(user);

      const score = await service.getSecurityScore('user-123');

      expect(score).toBe(20);
    });

    it('should increment score by 20 for PIN set', async () => {
      const user = { ...mockUser, emailVerified: false, phoneVerified: false, pinHash: 'hashed-pin', passkeyId: null, kycStatus: KycStatus.NONE } as User;
      userRepo.findOne.mockResolvedValue(user);

      const score = await service.getSecurityScore('user-123');

      expect(score).toBe(20);
    });

    it('should increment score by 20 for passkey registered', async () => {
      const user = { ...mockUser, emailVerified: false, phoneVerified: false, pinHash: null, passkeyId: 'passkey-123', kycStatus: KycStatus.NONE } as User;
      userRepo.findOne.mockResolvedValue(user);

      const score = await service.getSecurityScore('user-123');

      expect(score).toBe(20);
    });

    it('should increment score by 20 for KYC approved', async () => {
      const user = { ...mockUser, emailVerified: false, phoneVerified: false, pinHash: null, passkeyId: null, kycStatus: KycStatus.APPROVED } as User;
      userRepo.findOne.mockResolvedValue(user);

      const score = await service.getSecurityScore('user-123');

      expect(score).toBe(20);
    });

    it('should return 0 when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const score = await service.getSecurityScore('nonexistent');

      expect(score).toBe(0);
    });
  });

  describe('recordLoginAttempt', () => {
    it('should create LoginHistory with status=success', async () => {
      const mockHistory = { id: 'history-123', userId: 'user-123', status: LoginStatus.SUCCESS } as LoginHistory;
      loginHistoryRepo.create.mockReturnValue(mockHistory);
      loginHistoryRepo.save.mockResolvedValue(mockHistory);
      userRepo.findOne.mockResolvedValue(mockUser);
      deviceRepo.findOne.mockResolvedValue(null);

      const result = await service.recordLoginAttempt(
        'user-123',
        '192.168.1.1',
        'Mozilla/5.0',
        LoginStatus.SUCCESS,
      );

      expect(loginHistoryRepo.create).toHaveBeenCalledWith({
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: LoginStatus.SUCCESS,
        failureReason: null,
      });
      expect(loginHistoryRepo.save).toHaveBeenCalledWith(mockHistory);
      expect(result.status).toBe(LoginStatus.SUCCESS);
    });

    it('should create LoginHistory with status=failed', async () => {
      const mockHistory = { id: 'history-123', userId: 'user-123', status: LoginStatus.FAILED, failureReason: LoginFailureReason.INVALID_PASSWORD } as LoginHistory;
      loginHistoryRepo.create.mockReturnValue(mockHistory);
      loginHistoryRepo.save.mockResolvedValue(mockHistory);

      const result = await service.recordLoginAttempt(
        'user-123',
        '192.168.1.1',
        'Mozilla/5.0',
        LoginStatus.FAILED,
        LoginFailureReason.INVALID_PASSWORD,
      );

      expect(loginHistoryRepo.create).toHaveBeenCalledWith({
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: LoginStatus.FAILED,
        failureReason: LoginFailureReason.INVALID_PASSWORD,
      });
      expect(result.status).toBe(LoginStatus.FAILED);
    });

    it('should trigger new device check on successful login', async () => {
      const mockHistory = { id: 'history-123', userId: 'user-123', status: LoginStatus.SUCCESS } as LoginHistory;
      loginHistoryRepo.create.mockReturnValue(mockHistory);
      loginHistoryRepo.save.mockResolvedValue(mockHistory);
      deviceRepo.findOne.mockResolvedValue(null); // New device
      alertRepo.create.mockReturnValue({
        userId: 'user-123',
        type: SecurityAlertType.NEW_DEVICE,
        message: 'New device login from 192.168.1.1',
      } as SecurityAlert);
      alertRepo.save.mockResolvedValue({} as SecurityAlert);

      await service.recordLoginAttempt(
        'user-123',
        '192.168.1.1',
        'Mozilla/5.0',
        LoginStatus.SUCCESS,
      );

      expect(deviceRepo.findOne).toHaveBeenCalled();
    });
  });

  describe('createAlert', () => {
    it('should create SecurityAlert with correct type and message', async () => {
      const mockAlert = {
        id: 'alert-123',
        userId: 'user-123',
        type: SecurityAlertType.NEW_DEVICE,
        message: 'New device login',
      } as SecurityAlert;

      alertRepo.create.mockReturnValue(mockAlert);
      alertRepo.save.mockResolvedValue(mockAlert);

      await service.createAlert('user-123', SecurityAlertType.NEW_DEVICE, 'New device login');

      expect(alertRepo.create).toHaveBeenCalledWith({
        userId: 'user-123',
        type: SecurityAlertType.NEW_DEVICE,
        message: 'New device login',
      });
      expect(alertRepo.save).toHaveBeenCalledWith(mockAlert);
    });
  });

  describe('getOverview', () => {
    it('should return complete SecurityOverviewDto', async () => {
      userRepo.findOne.mockResolvedValue(mockUser);
      sessionRepo.count.mockResolvedValue(2);
      loginHistoryRepo.findOne.mockResolvedValue({
        createdAt: new Date('2024-03-26'),
        ipAddress: '192.168.1.1',
      } as LoginHistory);
      alertRepo.find.mockResolvedValue([
        { id: 'alert-1', type: SecurityAlertType.NEW_DEVICE, message: 'New device', isRead: false, createdAt: new Date() } as SecurityAlert,
      ]);
      deviceRepo.count.mockResolvedValue(3);

      const overview = await service.getOverview('user-123');

      expect(overview.securityScore).toBe(100);
      expect(overview.emailVerified).toBe(true);
      expect(overview.phoneVerified).toBe(true);
      expect(overview.hasPin).toBe(true);
      expect(overview.hasPasskey).toBe(true);
      expect(overview.kycStatus).toBe(KycStatus.APPROVED);
      expect(overview.activeSessions).toBe(2);
      expect(overview.trustedDevices).toBe(3);
      expect(overview.lastLoginIp).toBe('192.168.1.1');
      expect(overview.recentAlerts.length).toBe(1);
    });
  });

  describe('getTrustedDevices', () => {
    it('should return paginated trusted devices', async () => {
      const mockDevices = [
        { id: 'device-1', deviceName: 'iPhone', lastSeenAt: new Date(), createdAt: new Date() } as TrustedDevice,
        { id: 'device-2', deviceName: 'MacBook', lastSeenAt: new Date(), createdAt: new Date() } as TrustedDevice,
      ];

      deviceRepo.findAndCount.mockResolvedValue([mockDevices, 2]);

      const result = await service.getTrustedDevices('user-123', 1, 20);

      expect(result.data.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('revokeTrustedDevice', () => {
    it('should delete trusted device', async () => {
      deviceRepo.delete.mockResolvedValue({ affected: 1 } as any);

      await service.revokeTrustedDevice('user-123', 'device-123');

      expect(deviceRepo.delete).toHaveBeenCalledWith({
        id: 'device-123',
        userId: 'user-123',
      });
    });
  });

  describe('markAlertAsRead', () => {
    it('should update alert isRead flag', async () => {
      alertRepo.update.mockResolvedValue({ affected: 1 } as any);

      await service.markAlertAsRead('user-123', 'alert-123');

      expect(alertRepo.update).toHaveBeenCalledWith(
        { id: 'alert-123', userId: 'user-123' },
        { isRead: true },
      );
    });
  });
});
