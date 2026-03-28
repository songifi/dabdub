import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionService } from './transactions.service';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
} from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';

describe('TransactionService', () => {
  let service: TransactionService;
  let repository: Repository<Transaction>;

  const mockTransaction = (overrides?: Partial<Transaction>): Transaction => {
    const transaction = new Transaction();
    transaction.id = 'tx-1';
    transaction.userId = 'user-1';
    transaction.type = TransactionType.TRANSFER_IN;
    transaction.amount = '100.00';
    transaction.fee = null;
    transaction.balanceAfter = '500.00';
    transaction.status = TransactionStatus.COMPLETED;
    transaction.reference = 'ref-1';
    transaction.counterpartyUsername = 'alice';
    transaction.note = null;
    transaction.metadata = {};
    transaction.createdAt = new Date('2025-01-01T12:00:00Z');
    transaction.updatedAt = new Date('2025-01-01T12:00:00Z');
    return { ...transaction, ...overrides };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    repository = module.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a transfer_in transaction', async () => {
      const createDto: CreateTransactionDto = {
        userId: 'user-1',
        type: TransactionType.TRANSFER_IN,
        amount: '100.00',
        balanceAfter: '500.00',
        reference: 'ref-1',
        counterpartyUsername: 'alice',
      };

      const transaction = mockTransaction();
      jest.spyOn(repository, 'create').mockReturnValue(transaction);
      jest.spyOn(repository, 'save').mockResolvedValue(transaction);

      const result = await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        type: TransactionType.TRANSFER_IN,
        amount: '100.00',
        fee: undefined,
        balanceAfter: '500.00',
        status: TransactionStatus.PENDING,
        reference: 'ref-1',
        counterpartyUsername: 'alice',
        note: undefined,
        metadata: {},
      });
      expect(repository.save).toHaveBeenCalledWith(transaction);
      expect(result.type).toBe(TransactionType.TRANSFER_IN);
      expect(result.amount).toBe('100.00');
    });

    it('should create a transfer_out transaction', async () => {
      const createDto: CreateTransactionDto = {
        userId: 'user-1',
        type: TransactionType.TRANSFER_OUT,
        amount: '50.00',
        fee: '1.00',
        balanceAfter: '449.00',
        reference: 'ref-2',
        counterpartyUsername: 'bob',
      };

      const transaction = mockTransaction({
        type: TransactionType.TRANSFER_OUT,
        amount: '50.00',
        fee: '1.00',
        balanceAfter: '449.00',
        reference: 'ref-2',
        counterpartyUsername: 'bob',
      });

      jest.spyOn(repository, 'create').mockReturnValue(transaction);
      jest.spyOn(repository, 'save').mockResolvedValue(transaction);

      const result = await service.create(createDto);

      expect(result.type).toBe(TransactionType.TRANSFER_OUT);
      expect(result.amount).toBe('50.00');
      expect(result.fee).toBe('1.00');
    });
  });

  describe('findById', () => {
    it('should find a transaction by id and userId', async () => {
      const transaction = mockTransaction();
      jest.spyOn(repository, 'findOne').mockResolvedValue(transaction);

      const result = await service.findById('tx-1', 'user-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'tx-1', userId: 'user-1' },
      });
      expect(result.id).toBe('tx-1');
    });

    it('should throw NotFoundException when transaction not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.findById('tx-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not find transaction with different userId', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.findById('tx-1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByUserId', () => {
    it('should list all transactions for a user', async () => {
      const txs = [
        mockTransaction(),
        mockTransaction({
          id: 'tx-2',
          type: TransactionType.TRANSFER_OUT,
          createdAt: new Date('2025-01-01T11:00:00Z'),
        }),
      ];

      jest.spyOn(repository, 'find').mockResolvedValue(txs);

      const result = await service.findByUserId('user-1', {});

      expect(repository.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
        take: 21,
      });
      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeUndefined();
    });

    it('should filter transactions by type', async () => {
      const txs = [mockTransaction()];
      jest.spyOn(repository, 'find').mockResolvedValue(txs);

      const result = await service.findByUserId('user-1', {
        types: [TransactionType.TRANSFER_IN],
      });

      expect(repository.find).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          type: {
            _value: [TransactionType.TRANSFER_IN],
          },
        },
        order: { createdAt: 'DESC' },
        take: 21,
      });
      expect(result.items).toHaveLength(1);
    });

    it('should filter transactions by status', async () => {
      const txs = [mockTransaction()];
      jest.spyOn(repository, 'find').mockResolvedValue(txs);

      const result = await service.findByUserId('user-1', {
        status: TransactionStatus.COMPLETED,
      });

      expect(repository.find).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          status: TransactionStatus.COMPLETED,
        },
        order: { createdAt: 'DESC' },
        take: 21,
      });
    });

    it('should handle cursor-based pagination correctly', async () => {
      const txs = Array.from({ length: 21 }, (_, i) =>
        mockTransaction({
          id: `tx-${i}`,
          createdAt: new Date(
            new Date('2025-01-01T12:00:00Z').getTime() - i * 60000,
          ),
        }),
      );

      jest.spyOn(repository, 'find').mockResolvedValue(txs);

      const cursor = Buffer.from('2025-01-01T10:45:00.000Z').toString('base64');
      const result = await service.findByUserId('user-1', { cursor });

      // Should return first 20 items and have a nextCursor
      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toBeDefined();
    });

    it('should throw BadRequestException for invalid cursor', async () => {
      await expect(
        service.findByUserId('user-1', { cursor: 'invalid-cursor' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle transfer_in and transfer_out pair', async () => {
      const transferIn = mockTransaction({
        type: TransactionType.TRANSFER_IN,
        amount: '100.00',
      });
      const transferOut = mockTransaction({
        id: 'tx-2',
        type: TransactionType.TRANSFER_OUT,
        amount: '100.00',
        createdAt: new Date('2025-01-01T11:00:00Z'),
      });

      jest
        .spyOn(repository, 'find')
        .mockResolvedValue([transferIn, transferOut]);

      const result = await service.findByUserId('user-1', {});

      expect(result.items).toHaveLength(2);
      expect(result.items[0].type).toBe(TransactionType.TRANSFER_IN);
      expect(result.items[1].type).toBe(TransactionType.TRANSFER_OUT);
    });
  });
});
