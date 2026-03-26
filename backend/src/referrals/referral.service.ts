import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { GlobalConfigService } from '../config/global-config.service';
import { UserEntity } from '../database/entities/user.entity';
import { Referral, ReferralStatus } from './entities/referral.entity';
import { ReferralStatsDto } from './dto/referral-stats.dto';

interface ReferralRewardJobPayload {
  referralId: string;
}

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    @InjectRepository(Referral)
    private readonly referralRepository: Repository<Referral>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectQueue('referrals')
    private readonly referralQueue: Queue<ReferralRewardJobPayload>,
    private readonly configService: GlobalConfigService,
  ) {}

  async assertReferralCodeExists(referralCode: string): Promise<void> {
    const referrer = await this.userRepository.findOne({
      where: { referralCode },
    });

    if (!referrer) {
      throw new BadRequestException('Invalid referral code');
    }
  }

  async generateCode(userId: string): Promise<string> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    if (user.referralCode) {
      return user.referralCode;
    }

    const username = this.buildUsername(user);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = `CH-${username}-${this.generateSuffix()}`;
      const existingUser = await this.userRepository.findOne({
        where: { referralCode: code },
      });

      if (!existingUser) {
        user.referralCode = code;
        await this.userRepository.save(user);
        return code;
      }
    }

    throw new BadRequestException('Unable to generate a unique referral code');
  }

  async trackSignup(
    referralCode: string,
    newUserId: string,
  ): Promise<Referral> {
    const existingReferral = await this.referralRepository.findOne({
      where: { referredUserId: newUserId },
    });
    if (existingReferral) {
      return existingReferral;
    }

    const referrer = await this.userRepository.findOne({
      where: { referralCode },
    });
    if (!referrer) {
      throw new BadRequestException('Invalid referral code');
    }

    if (referrer.id === newUserId) {
      throw new BadRequestException('Users cannot refer themselves');
    }

    const referral = this.referralRepository.create({
      referrerId: referrer.id,
      referredUserId: newUserId,
      code: referralCode,
      status: ReferralStatus.PENDING,
      rewardAmountUsdc:
        this.configService.getAppConfig().referralRewardAmountUsdc,
      convertedAt: null,
      rewardedAt: null,
    });

    return this.referralRepository.save(referral);
  }

  async trackConversion(userId: string): Promise<boolean> {
    const pendingReferral = await this.referralRepository.findOne({
      where: {
        referredUserId: userId,
        status: ReferralStatus.PENDING,
      },
      order: { createdAt: 'ASC' },
    });

    if (!pendingReferral) {
      return false;
    }

    pendingReferral.status = ReferralStatus.CONVERTED;
    pendingReferral.convertedAt = new Date();
    pendingReferral.rewardAmountUsdc =
      this.configService.getAppConfig().referralRewardAmountUsdc;

    const savedReferral = await this.referralRepository.save(pendingReferral);

    await this.referralQueue.add('process-referral-reward', {
      referralId: savedReferral.id,
    });

    this.logger.log(
      `Referral ${savedReferral.id} converted for user ${userId}`,
    );
    return true;
  }

  async getStats(userId: string): Promise<ReferralStatsDto> {
    const referrals = await this.referralRepository.find({
      where: { referrerId: userId },
    });

    const totalEarned = referrals
      .filter((referral) => referral.status === ReferralStatus.REWARDED)
      .reduce(
        (sum, referral) => sum + Number(referral.rewardAmountUsdc || '0'),
        0,
      );

    return {
      totalReferred: referrals.length,
      converted: referrals.filter((r) =>
        [ReferralStatus.CONVERTED, ReferralStatus.REWARDED].includes(r.status),
      ).length,
      pending: referrals.filter((r) => r.status === ReferralStatus.PENDING)
        .length,
      totalEarnedUsdc: totalEarned.toFixed(2),
    };
  }

  async getRewardableReferral(referralId: string): Promise<Referral> {
    const referral = await this.referralRepository.findOne({
      where: { id: referralId },
    });

    if (!referral) {
      throw new NotFoundException(`Referral ${referralId} not found`);
    }

    return referral;
  }

  async markRewarded(
    referralId: string,
    rewardAmountUsdc: string,
  ): Promise<Referral> {
    const referral = await this.getRewardableReferral(referralId);
    referral.status = ReferralStatus.REWARDED;
    referral.rewardedAt = new Date();
    referral.rewardAmountUsdc = rewardAmountUsdc;
    return this.referralRepository.save(referral);
  }

  private buildUsername(user: UserEntity): string {
    const emailPrefix =
      user.email.split('@')[0] || `${user.firstName}${user.lastName}`;
    const sanitized = emailPrefix.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return (
      sanitized ||
      user.id
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 8)
        .toLowerCase()
    );
  }

  private generateSuffix(): string {
    return randomBytes(3).toString('hex').slice(0, 4).toUpperCase();
  }
}
