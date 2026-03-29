import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransfersService, TRANSFER_QUEUE } from './transfers.service';
import { Transfer, TransferStatus } from './entities/transfer.entity';
import { UsersService } from '../users/users.service';
import { TierService } from '../tier-config/tier.service';
import { TierLimitExceededException } from '../common/exceptions/tier-limit-exceeded.exception';
import { FeesService } from '../fees/fees.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockTransferRepo = {
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockFeesService = {
  computeFee: jest.fn(),
};

const mockQueue = {
  add: jest.fn().mockResolvedValue({}),
};

const mockUsersService = {
  findByUsername: jest.fn(),
};

const mockTierService = {
  checkTransferLimit: jest.fn(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeTransfer = (overrides: Partial<Transfer> = {}): Transfer =>
  ({
    id: 'transfer-uuid-1',
    fromUserId: 'user-uuid-1',
    toUserId: 'user-uuid-2',
    fromUsername: 'alice',
    toUsername: 'bob',
    amount: '10.000000',
    fee: '0.100000',
    netAmount: '9.900000',
    note: null,
    txHash: null,
    status: TransferStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as Transfer;

const makeUser = (overrides = {}) => ({
  id: 'user-uuid-2',
  username: 'bob',
  email: 'bob@example.com',
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TransfersService', () => {
  let service: TransfersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: getRepositoryToken(Transfer), useValue: mockTransferRepo },
        { provide: FeesService, useValue: mockFeesService },
        { provide: getQueueToken(TRANSFER_QUEUE), useValue: mockQueue },
        { provide: UsersService, useValue: mockUsersService },
        { provide: TierService, useValue: mockTierService },
      ],
    }).compile();

    service = module.get<TransfersService>(TransfersService);
  });

  // ── toUsername not found → 404 ────────────────────────────────────────────

  describe('create', () => {
    it('throws NotFoundException when toUsername does not exist', async () => {
      mockUsersService.findByUsername.mockResolvedValue(null);

      await expect(
        service.create('user-uuid-1', 'alice', {
          toUsername: 'ghost',
          amount: '10',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockTierService.checkTransferLimit).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when sender equals receiver', async () => {
      await expect(
        service.create('user-uuid-1', 'alice', {
          toUsername: 'alice',
          amount: '10',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // ── tier limit exceeded → 400/403 ─────────────────────────────────────

    it('throws TierLimitExceededException when daily limit is exceeded', async () => {
      mockUsersService.findByUsername.mockResolvedValue(makeUser());
      mockTierService.checkTransferLimit.mockRejectedValue(
        new TierLimitExceededException({
          limit: '100',
          used: '95',
          requested: '10',
        }),
      );

      await expect(
        service.create('user-uuid-1', 'alice', {
          toUsername: 'bob',
          amount: '10',
        }),
      ).rejects.toThrow(TierLimitExceededException);

      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('creates transfer and enqueues job on success', async () => {
      mockUsersService.findByUsername.mockResolvedValue(makeUser());
      mockTierService.checkTransferLimit.mockResolvedValue(undefined);
      mockFeesService.computeFee.mockResolvedValue({
        gross: '10.00000000',
        fee: '0.10000000',
        net: '9.90000000',
        feeConfigId: 'cfg-1',
      });
      const transfer = makeTransfer();
      mockTransferRepo.create.mockReturnValue(transfer);
      mockTransferRepo.save.mockResolvedValue(transfer);

      const result = await service.create('user-uuid-1', 'alice', {
        toUsername: 'bob',
        amount: '10',
      });

      expect(result).toEqual(transfer);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-transfer',
        { transferId: transfer.id },
        expect.any(Object),
      );
    });
  });

  // ── markFailed ────────────────────────────────────────────────────────────

  describe('markFailed', () => {
    it('sets status to failed', async () => {
      mockTransferRepo.update.mockResolvedValue({});

      await service.markFailed('transfer-uuid-1');

      expect(mockTransferRepo.update).toHaveBeenCalledWith('transfer-uuid-1', {
        status: TransferStatus.FAILED,
      });
    });
  });
});
