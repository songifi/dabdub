import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { MoreThan, Repository } from 'typeorm';
import { Otp, OtpType } from './entities/otp.entity';
import { OtpInvalidException } from './exceptions/otp-invalid.exception';
import { OtpRateLimitException } from './exceptions/otp-rate-limit.exception';

export const OTP_REDIS = 'OTP_REDIS';

const BCRYPT_COST = 10;
const OTP_TTL_MINUTES = 10;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(Otp)
    private readonly otpRepo: Repository<Otp>,
    @Inject(OTP_REDIS)
    private readonly redis: Redis,
  ) {}

  async generate(
    userId: string,
    type: OtpType,
    ipAddress: string,
  ): Promise<string> {
    await this.checkRateLimit(userId, type);

    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(code, BCRYPT_COST);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    await this.otpRepo.save(
      this.otpRepo.create({
        userId,
        codeHash,
        type,
        expiresAt,
        usedAt: null,
        ipAddress,
      }),
    );

    return code;
  }

  async verify(userId: string, type: OtpType, code: string): Promise<true> {
    const otp = await this.otpRepo.findOne({
      where: {
        userId,
        type,
        usedAt: null,
        expiresAt: MoreThan(new Date()),
      },
      order: {
        createdAt: 'DESC',
      },
    });

    if (!otp) {
      throw new OtpInvalidException();
    }

    const isMatch = await bcrypt.compare(code, otp.codeHash);
    if (!isMatch) {
      throw new OtpInvalidException();
    }

    otp.usedAt = new Date();
    await this.otpRepo.save(otp);

    return true;
  }

  private async checkRateLimit(userId: string, type: OtpType): Promise<void> {
    const key = `otp:rate:${userId}:${type}`;
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
    }

    if (count > RATE_LIMIT_MAX) {
      throw new OtpRateLimitException();
    }
  }
}
