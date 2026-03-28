import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ComplianceDashboardService, COMPLIANCE_QUEUE } from './compliance.service';
import {
  ComplianceEvent,
  ComplianceEventSeverity,
  ComplianceEventStatus,
  ComplianceEventType,
} from './entities/compliance-event.entity';
import {
  SarReportType,
  SarStatus,
  SuspiciousActivityReport,
} from './entities/suspicious-activity-report.entity';
import { User } from '../users/entities/user.entity';
import { Transaction, TransactionStatus, TransactionType } from '../transactions/entities/transaction.entity';
import { FraudFlag, FraudSeverity, FraudStatus } from '../fraud/entities/fraud-flag.entity';
import { KycSubmission } from '../kyc/entities/kyc-submission.entity';
import { TierConfig } from '../tier-config/entities/tier-config.entity';
import { EmailService } from '../email/email.service';

const makeRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  create: jest.fn((value) => value),
  save: jest.fn(),
});

describe('ComplianceDashboardService', () => {
  let service: ComplianceDashboardService;
  const complianceEventRepo = makeRepo();
  const sarRepo = makeRepo();
  const userRepo = makeRepo();
  const txRepo = makeRepo();
  const fraudRepo = makeRepo();
  const kycRepo = makeRepo();
  const tierRepo = makeRepo();
  const emailService = { queue: jest.fn() };
  const complianceQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceDashboardService,
        { provide: getRepositoryToken(ComplianceEvent), useValue: complianceEventRepo },
        { provide: getRepositoryToken(SuspiciousActivityReport), useValue: sarRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: getRepositoryToken(FraudFlag), useValue: fraudRepo },
        { provide: getRepositoryToken(KycSubmission), useValue: kycRepo },
        { provide: getRepositoryToken(TierConfig), useValue: tierRepo },
        { provide: EmailService, useValue: emailService },
        { provide: getQueueToken(COMPLIANCE_QUEUE), useValue: complianceQueue },
      ],
    }).compile();

    service = module.get(ComplianceDashboardService);
  });

  it('detects structuring on 3x $950 transactions in one day', async () => {
    const targetDate = new Date('2026-03-26T12:00:00.000Z');
    txRepo.find.mockResolvedValue([
      {
        id: 'tx-1',
        userId: 'user-1',
        amountUsdc: '950',
        status: TransactionStatus.COMPLETED,
        type: TransactionType.TRANSFER_OUT,
        createdAt: new Date('2026-03-26T08:00:00.000Z'),
      },
      {
        id: 'tx-2',
        userId: 'user-1',
        amountUsdc: '950',
        status: TransactionStatus.COMPLETED,
        type: TransactionType.TRANSFER_OUT,
        createdAt: new Date('2026-03-26T10:00:00.000Z'),
      },
      {
        id: 'tx-3',
        userId: 'user-1',
        amountUsdc: '950',
        status: TransactionStatus.COMPLETED,
        type: TransactionType.TRANSFER_OUT,
        createdAt: new Date('2026-03-26T13:00:00.000Z'),
      },
    ]);
    complianceEventRepo.find.mockResolvedValue([]);
    complianceEventRepo.save.mockImplementation(async (value) => ({
      id: 'event-1',
      ...value,
    }));

    const result = await service.detectStructuringForDate(targetDate);

    expect(result).toHaveLength(1);
    expect(complianceEventRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: ComplianceEventType.STRUCTURING,
        severity: ComplianceEventSeverity.HIGH,
        status: ComplianceEventStatus.OPEN,
      }),
    );
  });

  it('includes users with open events in high-risk users', async () => {
    complianceEventRepo.find.mockResolvedValue([
      { userId: 'user-1', status: ComplianceEventStatus.OPEN },
      { userId: 'user-1', status: ComplianceEventStatus.OPEN },
    ]);
    fraudRepo.find.mockResolvedValue([
      {
        userId: 'user-2',
        severity: FraudSeverity.HIGH,
        status: FraudStatus.OPEN,
      },
    ]);
    userRepo.find.mockResolvedValue([
      {
        id: 'user-1',
        email: 'risk@example.com',
        username: 'risky',
        isActive: true,
      },
      {
        id: 'user-2',
        email: 'fraud@example.com',
        username: 'fraudster',
        isActive: false,
      },
    ]);

    const result = await service.getHighRiskUsers(1, 20);

    expect(result.total).toBe(2);
    expect(result.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'user-1', complianceEventCount: 2 }),
        expect.objectContaining({ userId: 'user-2', highFraudFlagCount: 1 }),
      ]),
    );
  });

  it('creates a SAR draft correctly', async () => {
    sarRepo.save.mockImplementation(async (value) => ({
      id: 'sar-1',
      ...value,
    }));

    const result = await service.createSarDraft('admin-1', {
      userId: 'user-9',
      reportType: SarReportType.STRUCTURING,
      narrative: 'Customer made repeated transfers just below the reporting threshold.',
    });

    expect(sarRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-9',
        generatedBy: 'admin-1',
        reportType: SarReportType.STRUCTURING,
        status: SarStatus.DRAFT,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'sar-1',
        generatedBy: 'admin-1',
        status: SarStatus.DRAFT,
      }),
    );
  });
});
