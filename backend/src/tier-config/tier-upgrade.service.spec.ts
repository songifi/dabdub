import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TierUpgradeService } from './tier-upgrade.service';
import { TierService } from './tier.service';
import { TierConfig, TierName } from './entities/tier-config.entity';
import { User, KycStatus } from '../users/entities/user.entity';
import { EmailService } from '../email/email.service';

const mockCfg = (tier: TierName, overrides: Partial<TierConfig> = {}): TierConfig =>
  ({
    id: 'cfg-id',
    tier,
    dailyTransferLimitUsdc: '1000',
    monthlyTransferLimitUsdc: '10000',
    maxSingleWithdrawalUsdc: '500',
    feeDiscountPercent: tier === TierName.SILVER ? 0 : tier === TierName.GOLD ? 20 : 50,
    yieldApyPercent: '1.00',
    minStakeAmountUsdc: '0',
    stakeLockupDays: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as TierConfig;

describe('TierUpgradeService', () => {
  let service: TierUpgradeService;

  const tierRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const userRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const tierService = {
    upgradeTier: jest.fn(),
  };

  const emailService = {
    queue: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TierUpgradeService,
        { provide: getRepositoryToken(TierConfig), useValue: tierRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: TierService, useValue: tierService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get(TierUpgradeService);
  });

  describe('initiateUpgrade', () => {
    const baseUser: Partial<User> = {
      id: 'u1',
      emailVerified: true,
      phoneVerified: true,
      tier: TierName.SILVER,
      kycStatus: KycStatus.APPROVED,
      pendingTierUpgrade: null,
    };

    it('upgrades immediately when all requirements met', async () => {
      const u = { ...baseUser, email: 'a@b.c' } as User;
      userRepo.findOne.mockResolvedValueOnce(u).mockResolvedValueOnce(u);
      tierRepo.findOne.mockResolvedValue(mockCfg(TierName.GOLD));
      tierService.upgradeTier.mockResolvedValue({
        ...u,
        tier: TierName.GOLD,
      });
      userRepo.update.mockResolvedValue(undefined);

      const result = await service.initiateUpgrade('u1', TierName.GOLD);

      expect(result).toEqual({ status: 'upgraded', tier: TierName.GOLD });
      expect(tierService.upgradeTier).toHaveBeenCalledWith('u1', TierName.GOLD);
      expect(userRepo.update).toHaveBeenCalledWith('u1', {
        pendingTierUpgrade: null,
      });
      expect(emailService.queue).toHaveBeenCalledWith(
        expect.any(String),
        'tier-upgraded',
        expect.objectContaining({ tier: TierName.GOLD }),
      );
    });

    it('throws 400 when KYC pending and sets pending tier', async () => {
      userRepo.findOne.mockResolvedValue({
        ...baseUser,
        kycStatus: KycStatus.PENDING,
      } as User);
      userRepo.update.mockResolvedValue(undefined);

      await expect(service.initiateUpgrade('u1', TierName.GOLD)).rejects.toThrow(
        'KYC review in progress, upgrade will be automatic on approval',
      );

      expect(userRepo.update).toHaveBeenCalledWith('u1', {
        pendingTierUpgrade: TierName.GOLD,
      });
      expect(tierService.upgradeTier).not.toHaveBeenCalled();
    });

    it('throws 400 with redirect when KYC not submitted', async () => {
      userRepo.findOne.mockResolvedValue({
        ...baseUser,
        kycStatus: KycStatus.NONE,
      } as User);
      userRepo.update.mockResolvedValue(undefined);

      try {
        await service.initiateUpgrade('u1', TierName.GOLD);
        fail('expected throw');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        const r = (e as BadRequestException).getResponse() as {
          message: string;
          redirectTo: string;
        };
        expect(r.message).toBe('Please complete KYC verification first');
        expect(r.redirectTo).toBe('/kyc');
      }

      expect(userRepo.update).toHaveBeenCalledWith('u1', {
        pendingTierUpgrade: TierName.GOLD,
      });
    });

    it('rejects same tier (Silver → Silver)', async () => {
      userRepo.findOne.mockResolvedValue({
        ...baseUser,
        tier: TierName.SILVER,
      } as User);

      await expect(
        service.initiateUpgrade('u1', TierName.SILVER),
      ).rejects.toThrow(BadRequestException);
      expect(tierService.upgradeTier).not.toHaveBeenCalled();
    });
  });

  describe('checkAutoUpgrade', () => {
    it('applies pending tier on KYC approval path', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        tier: TierName.SILVER,
        pendingTierUpgrade: TierName.GOLD,
      } as User);
      tierService.upgradeTier.mockResolvedValue({} as User);
      userRepo.update.mockResolvedValue(undefined);
      tierRepo.findOne.mockResolvedValue(mockCfg(TierName.GOLD));

      const ok = await service.checkAutoUpgrade('u1');

      expect(ok).toBe(true);
      expect(tierService.upgradeTier).toHaveBeenCalledWith('u1', TierName.GOLD);
      expect(userRepo.update).toHaveBeenCalledWith('u1', {
        pendingTierUpgrade: null,
      });
    });

    it('returns false when no pending target', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        pendingTierUpgrade: null,
      } as User);

      const ok = await service.checkAutoUpgrade('u1');

      expect(ok).toBe(false);
      expect(tierService.upgradeTier).not.toHaveBeenCalled();
    });
  });

  describe('getUpgradeRequirements', () => {
    it('throws when user missing', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getUpgradeRequirements('x', TierName.GOLD),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns kycRequired for Gold target when KYC not approved', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        emailVerified: true,
        phoneVerified: true,
        tier: TierName.SILVER,
        kycStatus: KycStatus.NONE,
      } as User);
      tierRepo.findOne
        .mockResolvedValueOnce(mockCfg(TierName.SILVER))
        .mockResolvedValueOnce(mockCfg(TierName.GOLD));

      const r = await service.getUpgradeRequirements('u1', TierName.GOLD);
      expect(r.kycRequired).toBe(true);
      expect(r.benefits.virtualCardAccess).toEqual({
        current: false,
        target: true,
      });
    });
  });
});
