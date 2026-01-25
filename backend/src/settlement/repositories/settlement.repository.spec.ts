import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettlementRepository } from './settlement.repository';
import {
  Settlement,
  SettlementStatus,
  SettlementProvider,
} from '../entities/settlement.entity';

describe('SettlementRepository', () => {
  let repository: SettlementRepository;
  let mockRepository: jest.Mocked<Repository<Settlement>>;

  const mockSettlement: Settlement = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    paymentRequestId: '123e4567-e89b-12d3-a456-426614174001',
    merchantId: '123e4567-e89b-12d3-a456-426614174002',
    amount: 1000.5,
    currency: 'USD',
    status: SettlementStatus.PENDING,
    bankAccountNumber: '1234567890',
    bankRoutingNumber: '987654321',
    bankName: 'Test Bank',
    bankAccountHolderName: 'John Doe',
    bankSwiftCode: null,
    bankIban: null,
    batchId: null,
    batchSequence: null,
    feeAmount: 10.0,
    feePercentage: 0.01,
    netAmount: 990.5,
    exchangeRate: 1.0,
    sourceCurrency: 'USDC',
    provider: SettlementProvider.STRIPE,
    providerReference: null,
    settlementReceipt: null,
    settlementReference: null,
    failureReason: null,
    retryCount: 0,
    maxRetries: 3,
    settledAt: null,
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: null,
  };

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementRepository,
        {
          provide: getRepositoryToken(Settlement),
          useValue: mockRepo,
        },
      ],
    }).compile();

    repository = module.get<SettlementRepository>(SettlementRepository);
    mockRepository = module.get(getRepositoryToken(Settlement));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new settlement', async () => {
      const settlementData: Partial<Settlement> = {
        paymentRequestId: mockSettlement.paymentRequestId,
        merchantId: mockSettlement.merchantId,
        amount: mockSettlement.amount,
        currency: mockSettlement.currency,
      };

      mockRepository.create.mockReturnValue(mockSettlement);
      mockRepository.save.mockResolvedValue(mockSettlement);

      const result = await repository.create(settlementData);

      expect(mockRepository.create).toHaveBeenCalledWith(settlementData);
      expect(mockRepository.save).toHaveBeenCalledWith(mockSettlement);
      expect(result).toEqual(mockSettlement);
    });
  });

  describe('findOne', () => {
    it('should find a settlement by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockSettlement);

      const result = await repository.findOne(mockSettlement.id);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockSettlement.id },
      });
      expect(result).toEqual(mockSettlement);
    });

    it('should return null if settlement not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findOne('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByPaymentRequestId', () => {
    it('should find a settlement by payment request id', async () => {
      mockRepository.findOne.mockResolvedValue(mockSettlement);

      const result = await repository.findByPaymentRequestId(
        mockSettlement.paymentRequestId,
      );

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { paymentRequestId: mockSettlement.paymentRequestId },
      });
      expect(result).toEqual(mockSettlement);
    });
  });

  describe('findByMerchantId', () => {
    it('should find settlements by merchant id', async () => {
      const settlements = [mockSettlement];
      mockRepository.find.mockResolvedValue(settlements);

      const result = await repository.findByMerchantId(
        mockSettlement.merchantId,
      );

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { merchantId: mockSettlement.merchantId },
      });
      expect(result).toEqual(settlements);
    });
  });

  describe('findByStatus', () => {
    it('should find settlements by status', async () => {
      const settlements = [mockSettlement];
      mockRepository.find.mockResolvedValue(settlements);

      const result = await repository.findByStatus(SettlementStatus.PENDING);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { status: SettlementStatus.PENDING },
      });
      expect(result).toEqual(settlements);
    });
  });

  describe('updateStatus', () => {
    it('should update settlement status', async () => {
      const updatedSettlement = {
        ...mockSettlement,
        status: SettlementStatus.PROCESSING,
        processedAt: new Date(),
      };

      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(updatedSettlement as Settlement);

      const result = await repository.updateStatus(
        mockSettlement.id,
        SettlementStatus.PROCESSING,
      );

      expect(mockRepository.update).toHaveBeenCalledWith(
        mockSettlement.id,
        expect.objectContaining({
          status: SettlementStatus.PROCESSING,
          processedAt: expect.any(Date),
        }),
      );
      expect(result.status).toBe(SettlementStatus.PROCESSING);
    });

    it('should set settledAt when status is COMPLETED', async () => {
      const completedSettlement = {
        ...mockSettlement,
        status: SettlementStatus.COMPLETED,
        settledAt: new Date(),
      };

      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(
        completedSettlement as Settlement,
      );

      const result = await repository.updateStatus(
        mockSettlement.id,
        SettlementStatus.COMPLETED,
      );

      expect(mockRepository.update).toHaveBeenCalledWith(
        mockSettlement.id,
        expect.objectContaining({
          status: SettlementStatus.COMPLETED,
          settledAt: expect.any(Date),
        }),
      );
      expect(result.status).toBe(SettlementStatus.COMPLETED);
    });
  });

  describe('incrementRetryCount', () => {
    it('should increment retry count', async () => {
      const settlementWithRetry = {
        ...mockSettlement,
        retryCount: 1,
      };

      mockRepository.findOne.mockResolvedValue(mockSettlement);
      mockRepository.save.mockResolvedValue(settlementWithRetry as Settlement);

      const result = await repository.incrementRetryCount(mockSettlement.id);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockSettlement.id },
      });
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ retryCount: 1 }),
      );
      expect(result.retryCount).toBe(1);
    });

    it('should throw error if settlement not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        repository.incrementRetryCount('non-existent-id'),
      ).rejects.toThrow('Settlement with id non-existent-id not found');
    });
  });

  describe('count', () => {
    it('should return count of settlements', async () => {
      mockRepository.count.mockResolvedValue(10);

      const result = await repository.count();

      expect(mockRepository.count).toHaveBeenCalledWith({ where: undefined });
      expect(result).toBe(10);
    });
  });
});
