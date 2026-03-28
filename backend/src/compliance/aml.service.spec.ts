import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AmlService } from './aml.service';
import {
  ComplianceEvent,
  ComplianceEventSeverity,
  ComplianceEventStatus,
  ComplianceEventType,
} from './entities/compliance-event.entity';
import { User } from '../users/entities/user.entity';
import { Transaction, TransactionStatus } from '../transactions/entities/transaction.entity';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';

const makeRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((v) => v),
  save: jest.fn(async (v) => ({ id: 'event-id', ...v })),
  count: jest.fn(),
});

describe('AmlService.checkTransaction', () => {
  let service: AmlService;
  const eventRepo = makeRepo();
  const userRepo = makeRepo();
  const txRepo = makeRepo();
  const auditService = { log: jest.fn() };
  const emailService = { queue: jest.fn() };
  const configService = { get: jest.fn().mockReturnValue('true') }; // PREMBLY_MOCK=true

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmlService,
        { provide: getRepositoryToken(ComplianceEvent), useValue: eventRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Transaction), useValue: txRepo },
        { provide: AuditService, useValue: auditService },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: configService },
        { provide: HttpService, useValue: {} },
      ],
    }).compile();

    service = module.get(AmlService);
  });

  it('creates an AML_THRESHOLD event for a $1001 transaction', async () => {
    // No prior transactions today or this month
    txRepo.find.mockResolvedValue([]);

    const result = await service.checkTransaction('user-1', 1001, 'tx-1');

    expect(result.events).toHaveLength(1);
    expect(eventRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        txId: 'tx-1',
        eventType: ComplianceEventType.AML_THRESHOLD,
        severity: ComplianceEventSeverity.HIGH,
        status: ComplianceEventStatus.OPEN,
      }),
    );
    expect(result.autoFrozen).toBe(false);
  });

  it('creates a VOLUME_BREACH event when daily total exceeds $5000', async () => {
    // Simulate prior transactions that push daily total over $5000
    txRepo.find
      .mockResolvedValueOnce([
        // daily query
        { amountUsdc: '4500', status: TransactionStatus.COMPLETED },
        { amountUsdc: '600', status: TransactionStatus.COMPLETED },
      ])
      .mockResolvedValueOnce([]); // monthly query

    const result = await service.checkTransaction('user-2', 500, 'tx-2');

    const volumeBreachEvent = result.events.find(
      (e) => e.eventType === ComplianceEventType.VOLUME_BREACH,
    );
    expect(volumeBreachEvent).toBeDefined();
    expect(volumeBreachEvent?.severity).toBe(ComplianceEventSeverity.HIGH);
  });

  it('creates a CRITICAL VOLUME_BREACH and auto-freezes user when monthly total exceeds $20000', async () => {
    txRepo.find
      .mockResolvedValueOnce([]) // daily query — no daily breach
      .mockResolvedValueOnce([
        // monthly query — push over $20000
        { amountUsdc: '19500', status: TransactionStatus.COMPLETED },
        { amountUsdc: '600', status: TransactionStatus.COMPLETED },
      ]);

    const activeUser = { id: 'user-3', isActive: true, email: 'u@test.com', role: 'user' };
    userRepo.findOne.mockResolvedValue(activeUser);
    userRepo.find.mockResolvedValue([]); // no admins to notify
    userRepo.save.mockResolvedValue({ ...activeUser, isActive: false });

    const result = await service.checkTransaction('user-3', 600, 'tx-3');

    const criticalEvent = result.events.find(
      (e) => e.severity === ComplianceEventSeverity.CRITICAL,
    );
    expect(criticalEvent).toBeDefined();
    expect(criticalEvent?.eventType).toBe(ComplianceEventType.VOLUME_BREACH);
    expect(result.autoFrozen).toBe(true);
    expect(userRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
  });

  it('does not create any events for a $999 transaction with low cumulative volume', async () => {
    txRepo.find.mockResolvedValue([]);

    const result = await service.checkTransaction('user-4', 999, 'tx-4');

    expect(result.events).toHaveLength(0);
    expect(result.autoFrozen).toBe(false);
  });
});
