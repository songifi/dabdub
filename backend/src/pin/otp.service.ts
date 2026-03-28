import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../cache/redis.module';
import { jwtConfig } from '../config/jwt.config';
import { SmsService } from '../sms/sms.service';
import { User } from '../users/entities/user.entity';
import { OtpInvalidException } from './exceptions/otp-invalid.exception';
import { OtpType } from './otp.types';

const OTP_TTL_SECONDS = 600;

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
    @Inject(jwtConfig.KEY)
    private readonly jwt: ConfigType<typeof jwtConfig>,
    private readonly smsService: SmsService,
  ) {}

  async sendPinResetOtp(user: User): Promise<void> {
    if (!user.phone) {
      throw new BadRequestException('A phone number is required to send a PIN reset code');
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const digest = this.digest(user.id, OtpType.PIN_RESET, code);
    const key = this.redisKey(OtpType.PIN_RESET, user.id);
    await this.redis.setex(key, OTP_TTL_SECONDS, digest);

    await this.smsService.sendOtp(user.phone, code, user.id);
    this.logger.log(`Issued pin_reset OTP for user ${user.id}`);
  }

  async verifyOtp(userId: string, type: OtpType, code: string): Promise<void> {
    const key = this.redisKey(type, userId);
    const stored = await this.redis.get(key);
    if (!stored) {
      throw new OtpInvalidException();
    }

    const digest = this.digest(userId, type, code);
    if (
      stored.length !== digest.length ||
      !timingSafeEqual(Buffer.from(stored, 'utf8'), Buffer.from(digest, 'utf8'))
    ) {
      throw new OtpInvalidException();
    }

    await this.redis.del(key);
  }

  private redisKey(type: OtpType, userId: string): string {
    return `otp:${type}:${userId}`;
  }

  private digest(userId: string, type: OtpType, code: string): string {
    return createHmac('sha256', this.jwt.accessSecret)
      .update(`${userId}:${type}:${code}`)
      .digest('hex');
  }
}
