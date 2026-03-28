import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DisputeService } from './dispute.service';
import { Dispute, DisputeStatus, DisputeType } from './entities/dispute.entity';
import { Transaction, TransactionStatus, TransactionType } from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { SorobanService } from '../soroban/soroban.service';
import { NotificationService } from '../notifications/notifications.service';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

const mockTx = (overrides: Partial<Transaction> = {}): Transaction =>
  ({
    id: 'tx-1',
    userId: 'user-1',
    type: TransactionType.TRANSFER_OUT,
    amountUsdc: '10.000000',
    amount: 10,
    status: TransactionStatus.COMPLETED,
    counterpartyUsername: 'alice',
    createdAt: daysAgo(1),
    ...overrides,
  } as any);

const mockDispute = (overrides: Partial<Dispute> = {}): Dispute =>
  ({
    id: 'dispute-1',
    userId: 'user-1',
    transactionId: 'tx-1',
    type: DisputeType.UNAUTHORIZED,
    description: 'I did not make this',
    status: DisputeStatus.OPEN,
    resolution: null,
    resolvedBy: null,
    reversalTxHash: null,
    resolvedAt: null,
    createdAt: new Date(),
    ...overrides,
  } as any);

describe('DisputeService', () => {
  let service: DisputeService;
  let disputeRepo: any;
  let txRepo: any;
  let userRepo: any;
  let sorobanService: jest.Mocked<SorobanService>;
  let notificationService: jest.Mocked<NotificationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeService,
        {
          provide: getRepositoryToken(Dispute),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn((v) => Promise.resolve(v)),
            create: jest.fn((v) => v),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: SorobanService,
          useValue: { transfer: jest.fn() },
        },
        {
          provide: NotificationService,
          useValue: { create: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(DisputeService);
    disputeRepo = module.get(getRepositoryToken(Dispute));
    txRepo = module.get(getRepositoryToken(Transaction));
    userRepo = module.get(getRepositoryToken(User));
    sorobanService = module.get(SorobanService);
    notificationService = module.get(NotificationService);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { transactionId: 'tx-1', type: DisputeType.UNAUTHORIZED, description: 'Not me' };

    it('creates dispute for own completed transaction', async () => {
      txRepo.findOne.mockResolvedValue(mockTx());
      disputeRepo.findOne.mockResolvedValue(null);
      disputeRepo.save.mockResolvedValue(mockDispute());

      const result = await service.create('user-1', dto);
      expect(result.status).toBe(DisputeStatus.OPEN);
      expect(disputeRepo.save).toHaveBeenCalled();
    });

    it('throws 400 when transaction is older than 7 days', async () => {
      txRepo.findOne.mockResolvedValue(mockTx({ createdAt: daysAgo(8) }));

      await expect(service.create('user-1', dto)).rejects.toThrow(
        new BadRequestException('Dispute window has closed'),
      );
    });

    it('throws 409 when open dispute already exists for transaction', async () => {
      txRepo.findOne.mockResolvedValue(mockTx());
      disputeRepo.findOne.mockResolvedValue(mockDispute());

      await expect(service.create('user-1', dto)).rejects.toThrow(ConflictException);
    });

    it('throws 403 for another user\'s transaction', async () => {
      txRepo.findOne.mockResolvedValue(mockTx({ userId: 'user-other' }));

      await expect(service.create('user-1', dto)).rejects.toThrow(ForbiddenException);
    });

    it('throws 400 for non-completed transaction', async () => {
      txRepo.findOne.mockResolvedValue(mockTx({ status: TransactionStatus.PENDING }));

      await expect(service.create('user-1', dto)).rejects.toThrow(BadRequestException);
    });
  });

  // ── approve ───────────────────────────────────────────────────────────────

  describe('approve', () => {
    it('executes reversal transfer and marks resolved_approved', async () => {
      disputeRepo.findOne.mockResolvedValue(mockDispute());
      txRepo.findOne.mockResolvedValue(mockTx());
      userRepo.findOne.mockResolvedValue({ id: 'user-1', username: 'bob' });
      sorobanService.transfer.mockResolvedValue({ hash: 'REVERSAL_HASH' } as any);

      const result = await service.approve('dispute-1', 'admin-1');

      expect(sorobanService.transfer).toHaveBeenCalledWith(
        'alice', 'bob', '10.000000', expect.stringContaining('dispute-1'),
      );
      expect(result.status).toBe(DisputeStatus.RESOLVED_APPROVED);
      expect(result.resolvedBy).toBe('admin-1');
    });

    it('still resolves even if on-chain transfer throws', async () => {
      disputeRepo.findOne.mockResolvedValue(mockDispute());
      txRepo.findOne.mockResolvedValue(mockTx());
      userRepo.findOne.mockResolvedValue({ id: 'user-1', username: 'bob' });
      sorobanService.transfer.mockRejectedValue(new Error('contract error'));

      const result = await service.approve('dispute-1', 'admin-1');
      expect(result.status).toBe(DisputeStatus.RESOLVED_APPROVED);
    });

    it('throws 400 if dispute already resolved', async () => {
      disputeRepo.findOne.mockResolvedValue(
        mockDispute({ status: DisputeStatus.RESOLVED_APPROVED }),
      );

      await expect(service.approve('dispute-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ── reject ────────────────────────────────────────────────────────────────

  describe('reject', () => {
    it('marks resolved_rejected and releases hold (notifies user)', async () => {
      disputeRepo.findOne.mockResolvedValue(mockDispute());

      const result = await service.reject('dispute-1', 'admin-1', 'Transaction was valid');

      expect(result.status).toBe(DisputeStatus.RESOLVED_REJECTED);
      expect(result.resolution).toBe('Transaction was valid');
      expect(notificationService.create).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
        expect.stringContaining('rejected'),
        expect.any(String),
        expect.any(Object),
      );
    });
  });
});
