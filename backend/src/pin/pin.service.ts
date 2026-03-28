import * as bcrypt from 'bcrypt';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { REDIS_CLIENT } from '../cache/redis.module';
import { User } from '../users/entities/user.entity';
import { PinInvalidException } from './exceptions/pin-invalid.exception';
import { PinLockedException } from './exceptions/pin-locked.exception';
import { OtpService } from './otp.service';
import { OtpType } from './otp.types';

const PIN_PATTERN = /^[0-9]{4}$/;
const BCRYPT_COST = 10;
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 15 * 60;

@Injectable()
export class PinService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    private readonly otpService: OtpService,
  ) {}

  async setInitialPin(userId: string, pin: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'pinHash'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.pinHash != null && user.pinHash !== '') {
      throw new ConflictException(
        'PIN is already set. Use PATCH /pin/change to update it.',
      );
    }

    await this.setPin(userId, pin);
  }

  async setPin(userId: string, pin: string): Promise<void> {
    if (!PIN_PATTERN.test(pin)) {
      throw new PinInvalidException();
    }

    const pinHash = await bcrypt.hash(pin, BCRYPT_COST);
    await this.userRepo.update({ id: userId }, { pinHash });
  }

  async verifyPin(userId: string, pin: string): Promise<void> {
    const lockTtlMs = await this.redis.pttl(`pin:lock:${userId}`);
    if (lockTtlMs > 0) {
      throw new PinLockedException(new Date(Date.now() + lockTtlMs).toISOString());
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'pinHash'],
    });
    if (!user?.pinHash) {
      throw new PinInvalidException();
    }

    const ok = await bcrypt.compare(pin, user.pinHash);
    if (ok) {
      await this.redis.del(`pin:attempts:${userId}`);
      return;
    }

    const attempts = await this.redis.incr(`pin:attempts:${userId}`);
    if (attempts >= MAX_ATTEMPTS) {
      await this.redis.set(`pin:lock:${userId}`, '1', 'EX', LOCK_SECONDS);
      await this.redis.del(`pin:attempts:${userId}`);
    }

    throw new PinInvalidException();
  }

  async requestPinResetCode(actor: User): Promise<void> {
    await this.otpService.sendPinResetOtp(actor);
  }

  async resetPin(userId: string, newPin: string, otpCode: string): Promise<void> {
    await this.otpService.verifyOtp(userId, OtpType.PIN_RESET, otpCode);
    await this.setPin(userId, newPin);
  }

  async changePin(userId: string, currentPin: string, newPin: string): Promise<void> {
    await this.verifyPin(userId, currentPin);
    await this.setPin(userId, newPin);
  }

  async hasPin(userId: string): Promise<boolean> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['pinHash'],
    });
    return Boolean(user?.pinHash);
  }

  async getStatus(userId: string): Promise<{
    hasPin: boolean;
    isLocked: boolean;
    lockExpiresAt?: string;
  }> {
    const [hasPin, lockTtlMs] = await Promise.all([
      this.hasPin(userId),
      this.redis.pttl(`pin:lock:${userId}`),
    ]);

    const isLocked = lockTtlMs > 0;
    const lockExpiresAt =
      isLocked ? new Date(Date.now() + lockTtlMs).toISOString() : undefined;

    return { hasPin, isLocked, lockExpiresAt };
  }
}
