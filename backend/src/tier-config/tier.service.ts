import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TierConfig, TierName } from './entities/tier-config.entity';
import { User } from '../users/entities/user.entity';
import { Transaction, TransactionType } from '../transactions/entities/transaction.entity';
import { TierLimitExceededException } from '../common/exceptions/tier-limit-exceeded.exception';

@Injectable()
export class TierService {
  private readonly logger = new Logger(TierService.name);

  constructor(
    @InjectRepository(TierConfig)
    private readonly tierRepo: Repository<TierConfig>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  /**
   * Sums today's transfer_out amounts + current amount and checks against daily limit.
   */
  async checkTransferLimit(userId: string, amount: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const config = await this.tierRepo.findOne({ where: { tier: user.tier } });
    if (!config) return;

    // Calculate today's transfers (start of day to now)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sum today's transfer_out amounts
    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select('SUM(CAST(tx.amount_usdc AS NUMERIC))', 'sum')
      .where('tx.user_id = :userId', { userId })
      .andWhere('tx.type = :type', { type: TransactionType.TRANSFER_OUT })
      .andWhere('tx.createdAt >= :today', { today })
      .getRawOne();

    const usedToday = parseFloat(result?.sum || '0');
    const total = usedToday + amount;
    const limit = parseFloat(config.dailyTransferLimitUsdc);

    if (total > limit) {
      throw new TierLimitExceededException({
        limit: config.dailyTransferLimitUsdc,
        used: usedToday.toFixed(2),
        requested: amount.toFixed(2),
      });
    }
  }

  async checkWithdrawalLimit(userId: string, amount: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const config = await this.tierRepo.findOne({ where: { tier: user.tier } });
    if (!config) return;

    const limit = parseFloat(config.maxSingleWithdrawalUsdc);
    if (amount > limit) {
      throw new TierLimitExceededException({
        limit: config.maxSingleWithdrawalUsdc,
        used: '0',
        requested: amount.toString(),
      });
    }
  }

  async applyFeeDiscount(userId: string, fee: number): Promise<number> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return fee;

    const config = await this.tierRepo.findOne({ where: { tier: user.tier } });
    if (!config) return fee;

    const discount = (fee * config.feeDiscountPercent) / 100;
    return fee - discount;
  }

  async upgradeTier(userId: string, tier: TierName): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    user.tier = tier;
    const updatedUser = await this.userRepo.save(user);

    // Create Notification (STUB)
    this.logger.log(`Created upgrade notification for user ${userId} to tier ${tier}`);
    // await this.notificationService.create({ userId, type: 'tier_upgrade', ... })

    return updatedUser;
  }

  async getTierConfigs(): Promise<TierConfig[]> {
    return this.tierRepo.find({ where: { isActive: true } });
  }

  async getUserTierLimits(userId: string): Promise<TierConfig> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const config = await this.tierRepo.findOne({ where: { tier: user.tier } });
    if (!config) throw new NotFoundException('Tier configuration not found');

    return config;
  }
}
