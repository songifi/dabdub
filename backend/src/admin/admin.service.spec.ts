import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { FraudFlag } from '../fraud/entities/fraud-flag.entity';
import { Session } from '../auth/entities/session.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { EmailService } from '../email/email.service';
import { AuditService } from '../audit/audit.service';
import { NotificationService } from '../notifications/notifications.service';
import { CacheService } from '../cache/cache.service';

describe('AdminService', () => {
  let service: AdminService;
  let userRepo: any;
  let sessionRepo: any;
  let tokenRepo: any;
  let fraudRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: { findAndCount: jest.fn(), find: jest.fn(), createQueryBuilder: jest.fn() },
        },
        {
          provide: getRepositoryToken(FraudFlag),
          useValue: { find: jest.fn(), save: jest.fn(), create: jest.fn(), count: jest.fn(), update: jest.fn() },
        },
        {
          provide: getRepositoryToken(Session),
          useValue: { find: jest.fn(), delete: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: { update: jest.fn() },
        },
        {
          provide: EmailService,
          useValue: { queue: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn() },
        },
        {
          provide: NotificationService,
          useValue: { broadcast: jest.fn() },
        },
        {
          provide: CacheService,
          useValue: { getActiveUsersTodayCount: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userRepo = module.get(getRepositoryToken(User));
    sessionRepo = module.get(getRepositoryToken(Session));
    tokenRepo = module.get(getRepositoryToken(RefreshToken));
    fraudRepo = module.get(getRepositoryToken(FraudFlag));
  });

  it('should revoke sessions on freezeUser', async () => {
    const userId = 'user-123';
    const adminId = 'admin-456';
    const user = { id: userId, email: 'test@example.com', isActive: true };
    const sessions = [{ id: 'sess-1', refreshTokenId: 'rt-1' }];

    userRepo.findOne.mockResolvedValue(user);
    sessionRepo.find.mockResolvedValue(sessions);
    fraudRepo.create.mockReturnValue({});

    await service.freezeUser(userId, 'bad behavior', adminId);

    expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    expect(sessionRepo.delete).toHaveBeenCalledWith(['sess-1']);
    expect(tokenRepo.update).toHaveBeenCalledWith(['rt-1'], expect.objectContaining({ revokedAt: expect.any(Date) }));
    expect(fraudRepo.save).toHaveBeenCalled();
  });
});
