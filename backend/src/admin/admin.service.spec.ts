import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Merchant, MerchantStatus } from '../merchants/entities/merchant.entity';
import { Payment } from '../payments/entities/payment.entity';
import { NotFoundException } from '@nestjs/common';

describe('AdminService', () => {
  let service: AdminService;
  let merchantsRepo: any;
  let paymentsRepo: any;

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
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    merchantsRepo = module.get(getRepositoryToken(Merchant));
    paymentsRepo = module.get(getRepositoryToken(Payment));
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
      // Mock findOne: '1' succeeds, '2' fails
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
        .mockResolvedValueOnce([{ status: 'completed', count: '5', totalUsd: '500' }]) // payments
        .mockResolvedValueOnce([{ status: 'active', count: '2' }]); // merchants

      const result = await service.getGlobalStats();
      expect(result.payments).toHaveLength(1);
      expect(result.merchants).toHaveLength(1);
      expect(result.payments[0].status).toBe('completed');
      expect(result.merchants[0].status).toBe('active');
    });
  });
});
