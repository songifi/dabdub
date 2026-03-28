import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bull';
import { Repository } from 'typeorm';
import { GlobalConfigService } from '../config/global-config.service';
import { UserEntity } from '../database/entities/user.entity';
import { NotificationType } from '../notification/entities/notification.entity';
import { NotificationService } from '../notification/notification.service';
import { SorobanService } from '../stellar/soroban.service';
import { ReferralStatus } from './entities/referral.entity';
import { ReferralService } from './referral.service';

interface ReferralRewardJobPayload {
  referralId: string;
}

@Processor('referrals')
export class ReferralProcessor {
  private readonly logger = new Logger(ReferralProcessor.name);

  constructor(
    private readonly referralService: ReferralService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly notificationService: NotificationService,
    private readonly sorobanService: SorobanService,
    private readonly configService: GlobalConfigService,
  ) {}

  @Process('process-referral-reward')
  async handleProcessReferralReward(
    job: Job<ReferralRewardJobPayload>,
  ): Promise<void> {
    const referral = await this.referralService.getRewardableReferral(
      job.data.referralId,
    );

    if (referral.status === ReferralStatus.REWARDED) {
      return;
    }

    if (referral.status !== ReferralStatus.CONVERTED) {
      this.logger.warn(
        `Skipping referral ${referral.id} because status is ${referral.status}`,
      );
      return;
    }

    const rewardAmountUsdc =
      this.configService.getAppConfig().referralRewardAmountUsdc;
    const treasuryAddress =
      this.configService.getAppConfig().referralTreasuryAddress || '';

    try {
      await this.sorobanService.transfer(
        treasuryAddress,
        referral.referrerId,
        rewardAmountUsdc,
      );
      await this.sorobanService.transfer(
        treasuryAddress,
        referral.referredUserId,
        rewardAmountUsdc,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process referral reward for ${referral.id}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }

    await this.referralService.markRewarded(referral.id, rewardAmountUsdc);

    const [referrer, referredUser] = await Promise.all([
      this.userRepository.findOne({ where: { id: referral.referrerId } }),
      this.userRepository.findOne({ where: { id: referral.referredUserId } }),
    ]);

    if (referrer?.email) {
      await this.notificationService.sendNotification(
        referrer.id,
        NotificationType.EMAIL,
        referrer.email,
        `Your referral reward of ${rewardAmountUsdc} USDC has been paid.`,
        'Referral reward paid',
      );
    }

    if (referredUser?.email) {
      await this.notificationService.sendNotification(
        referredUser.id,
        NotificationType.EMAIL,
        referredUser.email,
        `Your signup reward of ${rewardAmountUsdc} USDC has been paid.`,
        'Referral reward paid',
      );
    }

    this.logger.log(`Referral reward processed for referral ${referral.id}`);
  }
}
