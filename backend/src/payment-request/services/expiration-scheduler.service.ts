import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PAYMENT_EXPIRY_QUEUE } from '../processors/payment-expiry.processor';

@Injectable()
export class ExpirationSchedulerService {
  private readonly logger = new Logger(ExpirationSchedulerService.name);

  constructor(
    @InjectQueue(PAYMENT_EXPIRY_QUEUE)
    private readonly expiryQueue: Queue,
  ) {}

  async scheduleExpiry(
    paymentRequestId: string,
    expiresAt: Date,
  ): Promise<void> {
    const delay = expiresAt.getTime() - Date.now();

    if (delay <= 0) {
      this.logger.warn(
        `Payment request ${paymentRequestId} already expired, processing immediately`,
      );
      await this.expiryQueue.add(
        'expire',
        { paymentRequestId },
        { jobId: paymentRequestId },
      );
      return;
    }

    await this.expiryQueue.add(
      'expire',
      { paymentRequestId },
      {
        jobId: paymentRequestId,
        delay,
      },
    );

    this.logger.debug(
      `Scheduled expiry for payment request ${paymentRequestId} in ${delay}ms`,
    );
  }

  async cancelExpiry(paymentRequestId: string): Promise<void> {
    const job = await this.expiryQueue.getJob(paymentRequestId);
    if (job) {
      await job.remove();
      this.logger.debug(
        `Cancelled expiry job for payment request ${paymentRequestId}`,
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanStaleJobs(): Promise<void> {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    await this.expiryQueue.clean(oneDayAgo, 100, 'completed');
    await this.expiryQueue.clean(oneDayAgo, 100, 'failed');
    this.logger.log('Cleaned stale expiry jobs');
  }
}
