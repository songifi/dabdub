import { BadRequestException } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { ReferralStatus } from './entities/referral.entity';

describe('ReferralService', () => {
  const createService = () => {
    const referralRepository = {
      findOne: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
      find: jest.fn(),
    };
    const userRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (value) => value),
    };
    const referralQueue = {
      add: jest.fn(),
    };
    const configService = {
      getAppConfig: jest.fn(() => ({
        referralRewardAmountUsdc: '5.00',
      })),
    };

    const service = new ReferralService(
      referralRepository as any,
      userRepository as any,
      referralQueue as any,
      configService as any,
    );

    return {
      service,
      referralRepository,
      userRepository,
      referralQueue,
    };
  };

  it('trackSignup creates a pending referral', async () => {
    const { service, referralRepository, userRepository } = createService();

    referralRepository.findOne.mockResolvedValueOnce(null);
    userRepository.findOne.mockResolvedValueOnce({
      id: 'user_referrer',
      referralCode: 'CH-john-AB12',
    });

    const referral = await service.trackSignup('CH-john-AB12', 'user_new');

    expect(referralRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        referrerId: 'user_referrer',
        referredUserId: 'user_new',
        code: 'CH-john-AB12',
        status: ReferralStatus.PENDING,
        rewardAmountUsdc: '5.00',
      }),
    );
    expect(referral.status).toBe(ReferralStatus.PENDING);
  });

  it('first conversion triggers conversion and enqueues reward job', async () => {
    const { service, referralRepository, referralQueue } = createService();

    referralRepository.findOne.mockResolvedValueOnce({
      id: 'ref_1',
      referredUserId: 'user_new',
      status: ReferralStatus.PENDING,
      rewardAmountUsdc: '0.00',
      createdAt: new Date(),
    });

    const converted = await service.trackConversion('user_new');

    expect(converted).toBe(true);
    expect(referralRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ref_1',
        status: ReferralStatus.CONVERTED,
        rewardAmountUsdc: '5.00',
      }),
    );
    expect(referralQueue.add).toHaveBeenCalledWith('process-referral-reward', {
      referralId: 'ref_1',
    });
  });

  it('second conversion is a no-op', async () => {
    const { service, referralRepository, referralQueue } = createService();

    referralRepository.findOne.mockResolvedValueOnce(null);

    const converted = await service.trackConversion('user_new');

    expect(converted).toBe(false);
    expect(referralRepository.save).not.toHaveBeenCalled();
    expect(referralQueue.add).not.toHaveBeenCalled();
  });

  it('rejects an invalid referral code on signup', async () => {
    const { service, referralRepository, userRepository } = createService();

    referralRepository.findOne.mockResolvedValueOnce(null);
    userRepository.findOne.mockResolvedValueOnce(null);

    await expect(
      service.trackSignup('bad-code', 'user_new'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
