import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TierService } from './tier.service';
import { TierConfig, TierName } from './entities/tier-config.entity';
import { User } from '../users/entities/user.entity';
import { Transaction, TransactionType } from '../transactions/entities/transaction.entity';
import { TierLimitExceededException } from '../common/exceptions/tier-limit-exceeded.exception';
import { NotFoundException } from '@nestjs/common';

describe('TierService', () => {
  let service: TierService;
  let tierRepo: any;
  let userRepo: any;
  let txRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TierService,
        {
          provide: getRepositoryToken(TierConfig),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TierService>(TierService);
    tierRepo = module.get(getRepositoryToken(TierConfig));
    userRepo = module.get(getRepositoryToken(User));
    txRepo = module.get(getRepositoryToken(Transaction));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkTransferLimit', () => {
    it('should throw TierLimitExceededException if daily limit exceeded (Silver: 50 limit, used 30, attempt 25)', async () => {
      const userId = 'user-1';
      const user = { id: userId, tier: TierName.SILVER };
      const config = { tier: TierName.SILVER, dailyTransferLimitUsdc: '50.00' };

      userRepo.findOne.mockResolvedValue(user);
      tierRepo.findOne.mockResolvedValue(config);

      const queryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ sum: '30.00' }),
      };
      txRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      await expect(service.checkTransferLimit(userId, 25)).rejects.toThrow(TierLimitExceededException);
    });

    it('should allow transfer if within daily limit', async () => {
      const userId = 'user-1';
      const user = { id: userId, tier: TierName.SILVER };
      const config = { tier: TierName.SILVER, dailyTransferLimitUsdc: '50.00' };

      userRepo.findOne.mockResolvedValue(user);
      tierRepo.findOne.mockResolvedValue(config);

      const queryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ sum: '10.00' }),
      };
      txRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      await expect(service.checkTransferLimit(userId, 25)).resolves.not.toThrow();
    });
  });

  describe('applyFeeDiscount', () => {
    it('should reduce fee by 20% for Gold tier', async () => {
      const userId = 'user-gold';
      const user = { id: userId, tier: TierName.GOLD };
      const config = { tier: TierName.GOLD, feeDiscountPercent: 20 };

      userRepo.findOne.mockResolvedValue(user);
      tierRepo.findOne.mockResolvedValue(config);

      const originalFee = 100;
      const discountedFee = await service.applyFeeDiscount(userId, originalFee);

      expect(discountedFee).toBe(80);
    });

    it('should not apply discount for Silver tier (0%)', async () => {
      const userId = 'user-silver';
      const user = { id: userId, tier: TierName.SILVER };
      const config = { tier: TierName.SILVER, feeDiscountPercent: 0 };

      userRepo.findOne.mockResolvedValue(user);
      tierRepo.findOne.mockResolvedValue(config);

      const originalFee = 100;
      const discountedFee = await service.applyFeeDiscount(userId, originalFee);

      expect(discountedFee).toBe(100);
    });
  });
});
