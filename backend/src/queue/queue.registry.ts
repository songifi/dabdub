import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, QueueEvents, Worker, type Job, type JobsOptions } from 'bullmq';
import { redisConfig } from '../config/redis.config';
import type { RedisConfig } from '../config/redis.config';
import {
  QUEUE_DEFAULT_JOB_OPTIONS,
  QUEUE_NAMES,
  type QueueName,
} from './queue.constants';
import type { DeadLetterNotification, QueueJobHandler } from './queue.types';
import { QueueAdminNotificationService } from './queue.admin-notification';

@Injectable()
export class QueueRegistryService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(QueueRegistryService.name);
  private readonly queues = new Map<QueueName, Queue>();
  private readonly workers = new Map<QueueName, Worker>();
  private readonly queueEvents = new Map<QueueName, QueueEvents>();
  private readonly handlers = new Map<QueueName, QueueJobHandler>();
  private readonly readyWorkers = new Set<QueueName>();
  private readonly connection: {
    host: string;
    port: number;
    password?: string;
  };

  constructor(
    @Inject(redisConfig.KEY)
    redis: RedisConfig,
    private readonly adminNotification: QueueAdminNotificationService,
  ) {
    this.connection = {
      host: redis.host,
      port: redis.port,
      password: redis.password,
    };

    for (const queueName of QUEUE_NAMES) {
      const queue = new Queue(queueName, {
        connection: this.connection,
        defaultJobOptions: QUEUE_DEFAULT_JOB_OPTIONS,
      });
      const worker = new Worker(
        queueName,
        async (job) => this.process(queueName, job),
        {
          connection: this.connection,
        },
      );
      const queueEvents = new QueueEvents(queueName, {
        connection: this.connection,
      });

      worker.on('ready', () => {
        this.readyWorkers.add(queueName);
        this.logger.log(`BullMQ worker ready for ${queueName}`);
      });
      worker.on('closed', () => {
        this.readyWorkers.delete(queueName);
      });
      queueEvents.on('failed', ({ jobId, failedReason }) => {
        void this.handleFailedEvent(queueName, jobId, failedReason);
      });

      this.queues.set(queueName, queue);
      this.workers.set(queueName, worker);
      this.queueEvents.set(queueName, queueEvents);
    }
  }

  async onModuleInit(): Promise<void> {
    await Promise.all([
      ...Array.from(this.queues.values(), (queue) => queue.waitUntilReady()),
      ...Array.from(this.workers.values(), (worker) => worker.waitUntilReady()),
      ...Array.from(this.queueEvents.values(), (events) =>
        events.waitUntilReady(),
      ),
    ]);

    for (const queueName of QUEUE_NAMES) {
      this.readyWorkers.add(queueName);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled(
      Array.from(this.queueEvents.values(), (events) => events.close()),
    );
    await Promise.allSettled(
      Array.from(this.workers.values(), (worker) => worker.close()),
    );
    await Promise.allSettled(
      Array.from(this.queues.values(), (queue) => queue.close()),
    );
  }

  registerHandler(queueName: QueueName, handler: QueueJobHandler): void {
    this.handlers.set(queueName, handler);
  }

  getQueue(queueName: QueueName): Queue {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue "${queueName}" is not registered`);
    }

    return queue;
  }

  getQueues(): Queue[] {
    return Array.from(this.queues.values());
  }

  hasActiveWorker(queueName: QueueName): boolean {
    return this.readyWorkers.has(queueName);
  }

  getWorkerStates(): Record<string, 'up' | 'down'> {
    return Object.fromEntries(
      QUEUE_NAMES.map((queueName) => [
        queueName,
        this.hasActiveWorker(queueName) ? 'up' : 'down',
      ]),
    );
  }

  async ping(): Promise<string> {
    const [queue] = this.queues.values();
    if (!queue) {
      throw new Error('No queues registered');
    }

    const client = await queue.client;
    return client.ping();
  }

  async add<T = unknown>(
    queueName: QueueName,
    jobName: string,
    payload: T,
    options?: JobsOptions,
  ) {
    return this.getQueue(queueName).add(jobName, payload, options);
  }

  private async process(queueName: QueueName, job: Job): Promise<unknown> {
    const handler = this.handlers.get(queueName);
    if (!handler) {
      throw new Error(`No queue handler registered for ${queueName}`);
    }

    return handler(job);
  }

  private async handleFailedEvent(
    queueName: QueueName,
    jobId?: string,
    failedReason = 'Unknown failure',
  ): Promise<void> {
    if (!jobId) {
      return;
    }

    const job = await this.getQueue(queueName).getJob(jobId);
    if (!job) {
      this.logger.warn(
        `BullMQ failed event fired for queue=${queueName} but job ${jobId} could not be loaded`,
      );
      return;
    }

    const maxAttempts =
      job.opts.attempts ?? QUEUE_DEFAULT_JOB_OPTIONS.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    const notification: DeadLetterNotification = {
      queueName,
      jobId,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
      failedReason,
      payload: job.data,
      options: job.opts,
    };

    this.logger.error(
      `Dead-lettered BullMQ job: ${JSON.stringify(notification)}`,
    );

    try {
      await this.adminNotification.notifyDeadLetter(notification);
    } catch (error) {
      this.logger.error(
        `Failed to notify admins about dead-lettered job ${jobId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
