import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Merchant, MerchantStatus } from '../merchants/entities/merchant.entity';
import { Payment } from '../payments/entities/payment.entity';
import { FeeConfig, FeeType } from '../fee-config/entities/fee-config.entity';
import { FeeHistory, FeeChangeType } from '../fee-config/entities/fee-history.entity';
import { NotFoundException } from '@nestjs/common';

describe('AdminService', () => {
  let service: AdminService;
  let merchantsRepo: any;
  let paymentsRepo: any;
  let feeConfigRepo: any;
  let feeHistoryRepo: any;

  const mockRepository = () => ({
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(Merchant),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(Payment),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(FeeConfig),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(FeeHistory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    merchantsRepo = module.get(getRepositoryToken(Merchant));
    paymentsRepo = module.get(getRepositoryToken(Payment));
    feeConfigRepo = module.get(getRepositoryToken(FeeConfig));
    feeHistoryRepo = module.get(getRepositoryToken(FeeHistory));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllMerchants', () => {
    it('should return paginated merchants with default values', async () => {
      const merchants = [{ id: '1', email: 'm1@test.com', passwordHash: 'hash' }];
      merchantsRepo.findAndCount.mockResolvedValue([merchants, 1]);

      const result = await service.findAllMerchants();
      expect(result.merchants).toHaveLength(1);
      expect(merchantsRepo.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        order: { createdAt: 'DESC' },
      });
    });

    it('should return paginated merchants with custom values', async () => {
      const merchants = [{ id: '1', email: 'm1@test.com', passwordHash: 'hash' }];
      merchantsRepo.findAndCount.mockResolvedValue([merchants, 1]);

      const result = await service.findAllMerchants(2, 10);
      expect(result.merchants).toHaveLength(1);
      expect(merchantsRepo.findAndCount).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOneMerchant', () => {
    it('should return a merchant if found', async () => {
      const merchant = { id: '1', email: 'm1@test.com' };
      merchantsRepo.findOne.mockResolvedValue(merchant);

      const result = await service.findOneMerchant('1');
      expect(result).toEqual(merchant);
    });

    it('should throw NotFoundException if merchant not found', async () => {
      merchantsRepo.findOne.mockResolvedValue(null);
      await expect(service.findOneMerchant('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMerchantStatus', () => {
    it('should update and return merchant status', async () => {
      const merchant = { id: '1', status: MerchantStatus.PENDING };
      merchantsRepo.findOne.mockResolvedValue(merchant);
      merchantsRepo.save.mockResolvedValue({ ...merchant, status: MerchantStatus.ACTIVE });

      const result = await service.updateMerchantStatus('1', MerchantStatus.ACTIVE);
      expect(result.status).toBe(MerchantStatus.ACTIVE);
      expect(merchantsRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if merchant not found', async () => {
      merchantsRepo.findOne.mockResolvedValue(null);
      await expect(service.updateMerchantStatus('1', MerchantStatus.ACTIVE)).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkUpdateMerchantStatus', () => {
    it('should handle partial failures', async () => {
      const ids = ['1', '2'];
      merchantsRepo.findOne
        .mockResolvedValueOnce({ id: '1', status: MerchantStatus.PENDING })
        .mockResolvedValueOnce(null);

      const result = await service.bulkUpdateMerchantStatus(ids, MerchantStatus.ACTIVE);

      expect(result.success).toContain('1');
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('2');
      expect(result.failed[0].error).toBe('Merchant not found');
    });

    it('should succeed for all when all exist', async () => {
      const ids = ['1', '2'];
      merchantsRepo.findOne.mockResolvedValue({ id: 'any', status: MerchantStatus.PENDING });

      const result = await service.bulkUpdateMerchantStatus(ids, MerchantStatus.ACTIVE);
      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
    });
  });

  describe('getGlobalStats', () => {
    it('should return aggregated stats', async () => {
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn(),
      };

      paymentsRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      merchantsRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      mockQueryBuilder.getRawMany
        .mockResolvedValueOnce([{ status: 'completed', count: '5', totalUsd: '500' }])
        .mockResolvedValueOnce([{ status: 'active', count: '2' }]);

      const result = await service.getGlobalStats();
      expect(result.payments).toHaveLength(1);
      expect(result.merchants).toHaveLength(1);
      expect(result.payments[0].status).toBe('completed');
      expect(result.merchants[0].status).toBe('active');
    });
  });

  describe('Fee Management', () => {
    it('should return all global fees', async () => {
      const fees = [
        { feeType: FeeType.TRANSFER, baseFeeRate: '0.010000' },
        { feeType: FeeType.WITHDRAWAL, baseFeeRate: '0.020000' },
      ];
      feeConfigRepo.find.mockResolvedValue(fees);

      const result = await service.getGlobalFees();

      expect(result).toEqual(fees);
      expect(feeConfigRepo.find).toHaveBeenCalledWith({ order: { feeType: 'ASC' } });
    });

    it('should update global fee and record history', async () => {
      const feeConfig = { feeType: FeeType.TRANSFER, baseFeeRate: '0.010000' };
      feeConfigRepo.findOne.mockResolvedValue(feeConfig);
      feeConfigRepo.save.mockResolvedValue({ ...feeConfig, baseFeeRate: '0.015000' });
      feeHistoryRepo.create.mockReturnValue({});

      const result = await service.updateGlobalFee(
        FeeType.TRANSFER,
        '0.015000',
        'admin-123',
        'Increased due to market conditions',
      );

      expect(feeConfigRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ baseFeeRate: '0.015000' }),
      );
      expect(feeHistoryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          feeType: FeeType.TRANSFER,
          changeType: FeeChangeType.GLOBAL,
          previousValue: '0.010000',
          newValue: '0.015000',
          actorId: 'admin-123',
          reason: 'Increased due to market conditions',
        }),
      );
      expect(feeHistoryRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when fee config not found', async () => {
      feeConfigRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateGlobalFee(FeeType.DEPOSIT, '0.005000', 'admin-123'),
      ).rejects.toThrow('Fee config for deposit not found');
    });
  });
});
