import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job, JobsOptions } from 'bullmq';
import type { JobStatusResponseDto } from './dto/job-status-response.dto';
import type { QueueStatsDto } from './dto/queue-stats.dto';

export const QUEUE_NAMES = [
  'settlements',
  'exports',
  'notifications',
  'refunds',
  'compliance-reports',
  'webhooks',
  'payment-expiry',
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly queues: Map<QueueName, Queue>;

  constructor(
    @InjectQueue('settlements') private settlementsQueue: Queue,
    @InjectQueue('exports') private exportsQueue: Queue,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('refunds') private refundsQueue: Queue,
    @InjectQueue('compliance-reports') private complianceReportsQueue: Queue,
    @InjectQueue('webhooks') private webhooksQueue: Queue,
    @InjectQueue('payment-expiry') private paymentExpiryQueue: Queue,
  ) {
    this.queues = new Map([
      ['settlements', this.settlementsQueue],
      ['exports', this.exportsQueue],
      ['notifications', this.notificationsQueue],
      ['refunds', this.refundsQueue],
      ['compliance-reports', this.complianceReportsQueue],
      ['webhooks', this.webhooksQueue],
      ['payment-expiry', this.paymentExpiryQueue],
    ]);
  }

  private getQueue(queueName: string): Queue {
    const q = this.queues.get(queueName as QueueName);
    if (!q) throw new NotFoundException(`Queue ${queueName} not found`);
    return q;
  }

  async enqueue<T>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<Job<T>> {
    const queue = this.getQueue(queueName);
    return queue.add(jobName, data, options);
  }

  async getStatus(queueName: string, jobId: string): Promise<JobStatusResponseDto | null> {
    const queue = this.getQueue(queueName);
    const job = await queue.getJob(jobId);
    if (!job) return null;
    return await this.toStatusResponse(queueName, job);
  }

  async getStatusFromAnyQueue(jobId: string): Promise<JobStatusResponseDto | null> {
    for (const name of QUEUE_NAMES) {
      const status = await this.getStatus(name, jobId);
      if (status) return status;
    }
    return null;
  }

  private async toStatusResponse(
    queueName: string,
    job: Job,
  ): Promise<JobStatusResponseDto> {
    const state = await job.getState();
    return {
      jobId: job.id ?? '',
      queue: queueName,
      jobName: job.name,
      status: state,
      progress: job.progress as number ?? 0,
      attemptsMade: job.attemptsMade,
      data: (job.data as Record<string, unknown>) ?? {},
      result: job.returnvalue ?? null,
      failedReason: job.failedReason ?? null,
      createdAt: job.timestamp
        ? new Date(job.timestamp).toISOString()
        : new Date(0).toISOString(),
      processedAt: job.processedOn
        ? new Date(job.processedOn).toISOString()
        : null,
      finishedAt: job.finishedOn
        ? new Date(job.finishedOn).toISOString()
        : null,
    };
  }

  async cancel(queueName: string, jobId: string): Promise<void> {
    const job = await this.getQueue(queueName).getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    await job.remove();
  }

  async retryFailed(queueName: string, jobId: string): Promise<Job | null> {
    const job = await this.getQueue(queueName).getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    const state = await job.getState();
    if (state !== 'failed') return null;
    await job.retry();
    return job;
  }

  async getQueueStats(queueName: string): Promise<QueueStatsDto> {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);
    const paused = isPaused ? 1 : 0;
    return { waiting, active, completed, failed, delayed, paused };
  }

  async getAllQueueStats(): Promise<Record<string, QueueStatsDto>> {
    const entries = await Promise.all(
      QUEUE_NAMES.map(async (name) => [name, await this.getQueueStats(name)] as const),
    );
    return Object.fromEntries(entries);
  }

  /**
   * Schedule a payment expiry job with a delay
   * @param paymentRequestId - The payment request ID
   * @param expiresAt - When the payment should expire
   * @param data - Additional data for the job
   */
  async schedulePaymentExpiry(
    paymentRequestId: string,
    expiresAt: Date,
    data: {
      merchantId: string;
      webhookUrl?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Job> {
    const delay = Math.max(0, expiresAt.getTime() - Date.now());
    
    return this.paymentExpiryQueue.add(
      'expire',
      {
        paymentRequestId,
        merchantId: data.merchantId,
        expiresAt: expiresAt.toISOString(),
        webhookUrl: data.webhookUrl,
        metadata: data.metadata,
      },
      {
        delay,
        jobId: `payment-expiry-${paymentRequestId}`,
        removeOnComplete: true,
        removeOnFail: { count: 100 },
      },
    );
  }

  /**
   * Cancel a payment expiry job
   * @param paymentRequestId - The payment request ID
   */
  async cancelPaymentExpiry(paymentRequestId: string): Promise<void> {
    const job = await this.paymentExpiryQueue.getJob(
      `payment-expiry-${paymentRequestId}`,
    );
    if (job) {
      await job.remove();
    }
  }

  /**
   * Clean up stale payment expiry jobs older than 24 hours
   * This should be called periodically (e.g., daily) to remove old delayed jobs
   */
  async cleanStalePaymentExpiryJobs(): Promise<number> {
    const staleThreshold = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
    let cleanedCount = 0;

    // Get all delayed jobs
    const delayedJobs = await this.paymentExpiryQueue.getDelayed();

    for (const job of delayedJobs) {
      // If the job is older than 24 hours, remove it
      if (job.timestamp < staleThreshold) {
        await job.remove();
        cleanedCount++;
        this.logger.log(
          `Removed stale payment expiry job ${job.id} for payment ${job.data.paymentRequestId}`,
        );
      }
    }

    return cleanedCount;
  }
}
