import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { ActivityService } from './activity.service';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';

// ── Factories ─────────────────────────────────────────────────────────────────

const makeTx = (overrides: Partial<Transaction> = {}): Transaction => {
  const tx = new Transaction();
  tx.id = 'tx-1';
  tx.userId = 'user-1';
  tx.type = TransactionType.TRANSFER_IN;
  tx.amountUsdc = '100.00000000';
  tx.amount = 100;
  tx.currency = 'USDC';
  tx.fee = null;
  tx.balanceAfter = '500.00000000';
  tx.status = TransactionStatus.COMPLETED;
  tx.reference = 'ref-1';
  tx.counterpartyUsername = null;
  tx.description = null;
  tx.metadata = {};
  tx.createdAt = new Date('2026-01-15T12:00:00Z');
  tx.updatedAt = new Date('2026-01-15T12:00:00Z');
  return Object.assign(tx, overrides);
};

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-2',
    username: 'alice',
    displayName: 'Alice Smith',
    ...overrides,
  }) as User;

// ── Mock query builder ────────────────────────────────────────────────────────

const makeQb = (rows: Transaction[]) => {
  const qb: Partial<SelectQueryBuilder<Transaction>> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
  };
  return qb as SelectQueryBuilder<Transaction>;
};

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ActivityService', () => {
  let service: ActivityService;

  const mockTxRepo = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockUserRepo = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: getRepositoryToken(Transaction), useValue: mockTxRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
  });

  // ── getFeed ───────────────────────────────────────────────────────────────

  describe('getFeed', () => {
    it('returns items with hasMore=false when results <= limit', async () => {
      const txs = [makeTx()];
      const qb = makeQb(txs);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);

      // No counterparties
      const userQb = makeQb([]);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getFeed('user-1', { limit: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it('sets hasMore=true and nextCursor when results exceed limit', async () => {
      // Return limit+1 rows to trigger pagination
      const txs = Array.from({ length: 21 }, (_, i) =>
        makeTx({
          id: `tx-${i}`,
          createdAt: new Date(Date.now() - i * 60_000),
        }),
      );
      const qb = makeQb(txs);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getFeed('user-1', { limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    it('caps limit at 50', async () => {
      const qb = makeQb([]);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.getFeed('user-1', { limit: 999 });

      // take() should be called with 51 (50 + 1)
      expect(qb.take).toHaveBeenCalledWith(51);
    });

    it('throws BadRequestException for invalid cursor', async () => {
      const qb = makeQb([]);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.getFeed('user-1', { after: 'not-valid-base64-date!!' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('enriches items with counterparty display name', async () => {
      const tx = makeTx({ counterpartyUsername: 'alice' });
      const qb = makeQb([tx]);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);

      const alice = makeUser({ username: 'alice', displayName: 'Alice Smith' });
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([alice]),
      });

      const result = await service.getFeed('user-1', {});

      expect(result.data[0].counterparty).toEqual({
        username: 'alice',
        displayName: 'Alice Smith',
      });
    });

    it('falls back to username-only counterparty when user not found', async () => {
      const tx = makeTx({ counterpartyUsername: 'ghost' });
      const qb = makeQb([tx]);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getFeed('user-1', {});

      expect(result.data[0].counterparty).toEqual({
        username: 'ghost',
        displayName: null,
      });
    });

    it('sets counterparty to null when no counterpartyUsername', async () => {
      const tx = makeTx({ counterpartyUsername: null });
      const qb = makeQb([tx]);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getFeed('user-1', {});

      expect(result.data[0].counterparty).toBeNull();
    });

    it('computes correct displayType and icon for each type', async () => {
      const types: TransactionType[] = [
        TransactionType.DEPOSIT,
        TransactionType.WITHDRAWAL,
        TransactionType.TRANSFER_IN,
        TransactionType.TRANSFER_OUT,
        TransactionType.YIELD_CREDIT,
      ];

      for (const type of types) {
        const qb = makeQb([makeTx({ type })]);
        mockTxRepo.createQueryBuilder.mockReturnValue(qb);
        mockUserRepo.createQueryBuilder.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        });

        const result = await service.getFeed('user-1', {});
        expect(result.data[0].displayType).toBeTruthy();
        expect(result.data[0].icon).toBeTruthy();
      }
    });

    it('computes amountNgn from metadata rateNgn', async () => {
      const tx = makeTx({
        amountUsdc: '10.00000000',
        metadata: { rateNgn: '1600' },
      });
      const qb = makeQb([tx]);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getFeed('user-1', {});

      expect(result.data[0].amountNgn).toBe('16000.00');
    });

    it('applies type filter via andWhere', async () => {
      const qb = makeQb([]);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.getFeed('user-1', { type: TransactionType.DEPOSIT });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'tx.type = :type',
        expect.objectContaining({ type: TransactionType.DEPOSIT }),
      );
    });

    it('applies status filter via andWhere', async () => {
      const qb = makeQb([]);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.getFeed('user-1', { status: TransactionStatus.PENDING });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'tx.status = :status',
        expect.objectContaining({ status: TransactionStatus.PENDING }),
      );
    });

    it('applies date range filters', async () => {
      const qb = makeQb([]);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.getFeed('user-1', {
        dateFrom: '2026-01-01T00:00:00Z',
        dateTo: '2026-01-31T23:59:59Z',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'tx.createdAt >= :dateFrom',
        expect.any(Object),
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'tx.createdAt <= :dateTo',
        expect.any(Object),
      );
    });

    it('applies search filter via ILIKE', async () => {
      const qb = makeQb([]);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.getFeed('user-1', { search: 'groceries' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(tx.description ILIKE :term OR tx.counterpartyUsername ILIKE :term)',
        { term: '%groceries%' },
      );
    });

    it('applies cursor filter via andWhere', async () => {
      const cursorDate = new Date('2026-01-10T12:00:00Z');
      const cursor = Buffer.from(cursorDate.toISOString()).toString('base64');

      const qb = makeQb([]);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      await service.getFeed('user-1', { after: cursor });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'tx.createdAt < :cursor',
        expect.objectContaining({ cursor: expect.any(Date) }),
      );
    });

    it('deduplicates counterparty batch load (no duplicate usernames)', async () => {
      const txs = [
        makeTx({ id: 'tx-1', counterpartyUsername: 'alice' }),
        makeTx({ id: 'tx-2', counterpartyUsername: 'alice' }),
      ];
      const qb = makeQb(txs);
      mockTxRepo.createQueryBuilder.mockReturnValue(qb);

      const userQbMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([makeUser()]),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(userQbMock);

      await service.getFeed('user-1', {});

      // getMany should be called once with deduplicated usernames
      expect(userQbMock.getMany).toHaveBeenCalledTimes(1);
      expect(userQbMock.where).toHaveBeenCalledWith(
        'u.username IN (:...usernames)',
        { usernames: ['alice'] },
      );
    });
  });

  // ── getDetail ─────────────────────────────────────────────────────────────

  describe('getDetail', () => {
    it('returns extended detail with blockchainTxHash from metadata', async () => {
      const tx = makeTx({
        metadata: { txHash: '0xabc123', rateNgn: '1600' },
      });
      mockTxRepo.findOne.mockResolvedValue(tx);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getDetail('tx-1', 'user-1');

      expect(result.blockchainTxHash).toBe('0xabc123');
      expect(result.reference).toBe('ref-1');
      expect(result.balanceAfter).toBe('500.00000000');
    });

    it('throws NotFoundException when transaction not found', async () => {
      mockTxRepo.findOne.mockResolvedValue(null);

      await expect(service.getDetail('tx-missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns null blockchainTxHash when not in metadata', async () => {
      const tx = makeTx({ metadata: {} });
      mockTxRepo.findOne.mockResolvedValue(tx);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getDetail('tx-1', 'user-1');

      expect(result.blockchainTxHash).toBeNull();
    });
  });

  // ── getSummary ────────────────────────────────────────────────────────────

  describe('getSummary', () => {
    it('calculates inflow, outflow, count, and average correctly', async () => {
      mockTxRepo.find.mockResolvedValue([
        makeTx({ type: TransactionType.TRANSFER_IN, amountUsdc: '100.00000000' }),
        makeTx({ type: TransactionType.DEPOSIT, amountUsdc: '50.00000000' }),
        makeTx({ type: TransactionType.TRANSFER_OUT, amountUsdc: '30.00000000' }),
        makeTx({ type: TransactionType.WITHDRAWAL, amountUsdc: '20.00000000' }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.totalInflow).toBe('150.00000000');
      expect(result.totalOutflow).toBe('50.00000000');
      expect(result.transactionCount).toBe(4);
      // avg = (150 + 50) / 4 = 50
      expect(result.averageTransactionValue).toBe('50.00000000');
    });

    it('returns zeros when no transactions', async () => {
      mockTxRepo.find.mockResolvedValue([]);

      const result = await service.getSummary('user-1');

      expect(result.totalInflow).toBe('0.00000000');
      expect(result.totalOutflow).toBe('0.00000000');
      expect(result.transactionCount).toBe(0);
      expect(result.averageTransactionValue).toBe('0.00000000');
    });

    it('counts yield_credit as inflow', async () => {
      mockTxRepo.find.mockResolvedValue([
        makeTx({ type: TransactionType.YIELD_CREDIT, amountUsdc: '5.00000000' }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.totalInflow).toBe('5.00000000');
      expect(result.totalOutflow).toBe('0.00000000');
    });

    it('counts stake as outflow', async () => {
      mockTxRepo.find.mockResolvedValue([
        makeTx({ type: TransactionType.STAKE, amountUsdc: '200.00000000' }),
      ]);

      const result = await service.getSummary('user-1');

      expect(result.totalOutflow).toBe('200.00000000');
      expect(result.totalInflow).toBe('0.00000000');
    });
  });

  // ── getMonthlyBreakdown ───────────────────────────────────────────────────

  describe('getMonthlyBreakdown', () => {
    it('returns 6 months of data', async () => {
      mockTxRepo.find.mockResolvedValue([]);

      const result = await service.getMonthlyBreakdown('user-1');

      expect(result).toHaveLength(6);
    });

    it('aggregates incoming and outgoing per month', async () => {
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      mockTxRepo.find.mockResolvedValue([
        makeTx({
          type: TransactionType.TRANSFER_IN,
          amountUsdc: '100.00000000',
          createdAt: now,
        }),
        makeTx({
          type: TransactionType.TRANSFER_OUT,
          amountUsdc: '40.00000000',
          createdAt: now,
        }),
      ]);

      const result = await service.getMonthlyBreakdown('user-1');
      const current = result.find((r) => r.month === thisMonth);

      expect(current).toBeDefined();
      expect(current!.incoming).toBe('100.00000000');
      expect(current!.outgoing).toBe('40.00000000');
    });

    it('pre-populates empty months with zeros', async () => {
      mockTxRepo.find.mockResolvedValue([]);

      const result = await service.getMonthlyBreakdown('user-1');

      for (const item of result) {
        expect(item.incoming).toBe('0.00000000');
        expect(item.outgoing).toBe('0.00000000');
      }
    });

    it('months are in ascending chronological order', async () => {
      mockTxRepo.find.mockResolvedValue([]);

      const result = await service.getMonthlyBreakdown('user-1');

      for (let i = 1; i < result.length; i++) {
        expect(result[i].month >= result[i - 1].month).toBe(true);
      }
    });
  });
});
