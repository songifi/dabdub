import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Redis } from 'ioredis';
import { SmsLog, SmsStatus } from './entities/sms-log.entity';
import { SmsRateLimitException } from './sms-rate-limit.exception';

export const SMS_QUEUE = 'sms-jobs';
export const SMS_REDIS = 'SMS_REDIS';

export interface SmsJobPayload {
  logId: string;
  phone: string;
  message: string;
}

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_TTL = 3600;

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @InjectRepository(SmsLog)
    private readonly logRepo: Repository<SmsLog>,
    @InjectQueue(SMS_QUEUE)
    private readonly smsQueue: Queue<SmsJobPayload>,
    @Inject(SMS_REDIS)
    private readonly redis: Redis,
  ) {}

  async queue(
    phone: string,
    message: string,
    userId?: string,
  ): Promise<SmsLog> {
    await this.checkRateLimit(phone);

    const log = await this.logRepo.save(
      this.logRepo.create({
        phone,
        message,
        status: SmsStatus.QUEUED,
        userId: userId ?? null,
        provider: 'termii',
      }),
    );

    await this.smsQueue.add(
      { logId: log.id, phone, message },
      {
        attempts: 3,
        backoff: { type: 'fixed', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: false,
        priority: 1,
      },
    );

    this.logger.log(`Queued SMS logId=${log.id} to=${phone}`);
    return log;
  }

  async sendOtp(phone: string, code: string, userId?: string): Promise<SmsLog> {
    const message = `Your Cheese verification code is ${code}. Do not share it. Expires in 10 minutes.`;
    return this.queue(phone, message, userId);
  }

  async sendAlert(
    phone: string,
    summary: string,
    userId?: string,
  ): Promise<SmsLog> {
    const message = `Cheese: ${summary}`;
    return this.queue(phone, message, userId);
  }

  private async checkRateLimit(phone: string): Promise<void> {
    const key = `sms:rate:${phone}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, RATE_LIMIT_TTL);
    }
    if (count > RATE_LIMIT_MAX) {
      throw new SmsRateLimitException(phone);
    }
  }
}
