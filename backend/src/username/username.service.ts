import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UsernameHistory } from './entities/username-history.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { SorobanService } from '../soroban/soroban.service';
import { validateUsername } from './username.validation';

@Injectable()
export class UsernameService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UsernameHistory)
    private readonly historyRepo: Repository<UsernameHistory>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    private readonly sorobanService: SorobanService,
    private readonly dataSource: DataSource,
  ) {}

  async isAvailable(
    username: string,
  ): Promise<{ available: boolean; reason?: string }> {
    const validation = validateUsername(username);
    if (!validation.valid) {
      return { available: false, reason: validation.error };
    }

    const existing = await this.userRepo.findOne({ where: { username } });
    if (existing) {
      return { available: false, reason: 'Username already taken' };
    }

    return { available: true };
  }

  async change(userId: string, newUsername: string): Promise<User> {
    const availability = await this.isAvailable(newUsername);
    if (!availability.available) {
      throw new BadRequestException(availability.reason);
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wallet = await this.walletRepo.findOne({ where: { userId } });
    if (!wallet) {
      throw new BadRequestException('User wallet not found');
    }

    // Check 30-day cooldown
    const lastChange = await this.historyRepo.findOne({
      where: { userId },
      order: { changedAt: 'DESC' },
    });

    if (lastChange) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (lastChange.changedAt > thirtyDaysAgo) {
        const remainingMs =
          lastChange.changedAt.getTime() +
          30 * 24 * 60 * 60 * 1000 -
          Date.now();
        const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
        throw new BadRequestException(
          `You can only change your username once every 30 days. Please wait ${remainingDays} more days.`,
        );
      }
    }

    const oldUsername = user.username;

    // Execute transaction
    return await this.dataSource.transaction(async (manager) => {
      // 1. Update User
      user.username = newUsername;
      const updatedUser = await manager.save(user);

      // 2. Create History
      const history = manager.create(UsernameHistory, {
        userId,
        oldUsername,
        newUsername,
      });
      await manager.save(history);

      // 3. Sync to Soroban
      try {
        await this.sorobanService.registerUser(newUsername, wallet.stellarAddress);
      } catch (err) {
        throw new BadRequestException(
          'Failed to sync username to blockchain. Please try again.',
        );
      }

      return updatedUser;
    });
  }
}