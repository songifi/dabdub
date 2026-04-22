import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import {
  FraudService,
  FRAUD_QUEUE,
  UserFreezePort,
  AdminNotificationPort,
} from './fraud.service';
import {
  FraudFlag,
  FraudSeverity,
  FraudStatus,
} from './entities/fraud-flag.entity';
import { FraudContext } from './dto/fraud-context.dto';
import { RuleDependencies } from './rules/rule.interface';

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
};

const mockQueue = {
  add: jest.fn(),
};

const mockUserFreeze: jest.Mocked<UserFreezePort> = {
  freezeUser: jest.fn(),
  unfreezeUser: jest.fn(),
};

const mockAdminNotification: jest.Mocked<AdminNotificationPort> = {
  notifyAdmin: jest.fn(),
};

const mockAuditLog = {
  log: jest.fn(),
};

const makeDeps = (overrides?: Partial<RuleDependencies>): RuleDependencies => ({
  countRecentTransfers: jest.fn().mockResolvedValue(0),
  getFirstTransactionDate: jest.fn().mockResolvedValue(null),
  ...overrides,
});

const baseContext: FraudContext = {
  amount: 50,
  txType: 'transfer_out',
  balanceBefore: 1000,
  balanceAfter: 950,
  accountCreatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
};

describe('FraudService', () => {
  let service: FraudService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FraudService,
        { provide: getRepositoryToken(FraudFlag), useValue: mockRepo },
        { provide: getQueueToken(FRAUD_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<FraudService>(FraudService);
  });

  describe('velocity.transfer rule', () => {
    it('fires on the 6th transfer in 1 hour', async () => {
      const deps = makeDeps({
        countRecentTransfers: jest.fn().mockResolvedValue(6),
      });

      const flagData = {
        userId: 'user-1',
        rule: 'velocity.transfer',
        severity: FraudSeverity.MEDIUM,
        description: expect.stringContaining('6'),
        triggeredBy: 'tx-1',
        status: FraudStatus.OPEN,
        resolvedBy: null,
        resolvedAt: null,
        resolutionNote: null,
      };

      mockRepo.create.mockReturnValue(flagData);
      mockRepo.save.mockResolvedValue({ id: 'flag-1', ...flagData });

      const flags = await service.evaluate(
        'user-1',
        'tx-1',
        baseContext,
        deps,
        {
          userFreeze: mockUserFreeze,
          adminNotification: mockAdminNotification,
        },
      );

      const velocityFlag = flags.find((f) => f.rule === 'velocity.transfer');
      expect(velocityFlag).toBeDefined();
      expect(velocityFlag!.severity).toBe(FraudSeverity.MEDIUM);
    });

    it('does not fire on exactly 5 transfers in 1 hour', async () => {
      const deps = makeDeps({
        countRecentTransfers: jest.fn().mockResolvedValue(5),
      });

      mockRepo.create.mockReturnValue({});
      mockRepo.save.mockResolvedValue({});

      const flags = await service.evaluate(
        'user-1',
        'tx-1',
        baseContext,
        deps,
        {
          userFreeze: mockUserFreeze,
          adminNotification: mockAdminNotification,
        },
      );

      const velocityFlag = flags.find((f) => f.rule === 'velocity.transfer');
      expect(velocityFlag).toBeUndefined();
    });
  });

  describe('high severity auto-freeze', () => {
    it('freezes the user and notifies admin when severity is high', async () => {
      const highSeverityContext: FraudContext = {
        ...baseContext,
        txType: 'withdrawal',
        amount: 500,
        accountCreatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days old
      };

      const flagData = {
        id: 'flag-high',
        userId: 'user-2',
        rule: 'large_first_withdrawal',
        severity: FraudSeverity.HIGH,
        description: 'Withdrawal of $500 within first 7 days',
        triggeredBy: 'tx-2',
        status: FraudStatus.OPEN,
        resolvedBy: null,
        resolvedAt: null,
        resolutionNote: null,
      };

      mockRepo.create.mockReturnValue(flagData);
      mockRepo.save.mockResolvedValue(flagData);
      mockUserFreeze.freezeUser.mockResolvedValue(undefined);
      mockAdminNotification.notifyAdmin.mockResolvedValue(undefined);

      const flags = await service.evaluate(
        'user-2',
        'tx-2',
        highSeverityContext,
        makeDeps(),
        {
          userFreeze: mockUserFreeze,
          adminNotification: mockAdminNotification,
        },
      );

      expect(flags.some((f) => f.severity === FraudSeverity.HIGH)).toBe(true);
      expect(mockUserFreeze.freezeUser).toHaveBeenCalledWith('user-2');
      expect(mockAdminNotification.notifyAdmin).toHaveBeenCalled();
    });
  });

  describe('resolveFlag — false_positive unfreezes user', () => {
    it('unfreezes the user when resolved as false_positive', async () => {
      const existingFlag: Partial<FraudFlag> = {
        id: 'flag-3',
        userId: 'user-3',
        rule: 'rapid_account_drain',
        severity: FraudSeverity.HIGH,
        status: FraudStatus.OPEN,
        resolvedBy: null,
        resolvedAt: null,
        resolutionNote: null,
      };

      mockRepo.findOne.mockResolvedValue(existingFlag);
      mockRepo.save.mockResolvedValue({
        ...existingFlag,
        status: FraudStatus.FALSE_POSITIVE,
        resolvedBy: 'admin-1',
        resolvedAt: expect.any(Date),
      });
      mockUserFreeze.unfreezeUser.mockResolvedValue(undefined);

      await service.resolveFlag(
        'flag-3',
        'admin-1',
        { resolution: FraudStatus.FALSE_POSITIVE, note: 'Legitimate transfer' },
        { userFreeze: mockUserFreeze, auditLog: mockAuditLog },
      );

      expect(mockUserFreeze.unfreezeUser).toHaveBeenCalledWith('user-3');
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        'admin-1',
        'fraud_flag.false_positive',
        expect.stringContaining('flag-3'),
      );
    });

    it('does not unfreeze when resolved as resolved (not false_positive)', async () => {
      const existingFlag: Partial<FraudFlag> = {
        id: 'flag-4',
        userId: 'user-4',
        status: FraudStatus.OPEN,
        resolvedBy: null,
        resolvedAt: null,
        resolutionNote: null,
      };

      mockRepo.findOne.mockResolvedValue(existingFlag);
      mockRepo.save.mockResolvedValue({
        ...existingFlag,
        status: FraudStatus.RESOLVED,
      });

      await service.resolveFlag(
        'flag-4',
        'admin-1',
        { resolution: FraudStatus.RESOLVED },
        { userFreeze: mockUserFreeze, auditLog: mockAuditLog },
      );

      expect(mockUserFreeze.unfreezeUser).not.toHaveBeenCalled();
    });
  });

  describe('enqueueCheck', () => {
    it('adds a job to the fraud queue', async () => {
      const payload = { userId: 'user-5', txId: 'tx-5', context: baseContext };
      await service.enqueueCheck(payload);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'fraud-check',
        payload,
        expect.objectContaining({ attempts: 3 }),
      );
    });
  });
});
