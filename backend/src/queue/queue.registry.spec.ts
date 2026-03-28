import { Logger } from '@nestjs/common';

const mockQueues: MockQueue[] = [];
const mockWorkers: MockWorker[] = [];
const mockQueueEvents: MockQueueEvents[] = [];

class MockQueue {
  public readonly client = Promise.resolve({
    ping: jest.fn().mockResolvedValue('PONG'),
  });
  public readonly waitUntilReady = jest.fn().mockResolvedValue(undefined);
  public readonly close = jest.fn().mockResolvedValue(undefined);
  public readonly getJob = jest.fn();
  public readonly add = jest.fn();

  constructor(
    public readonly name: string,
    public readonly options: unknown,
  ) {
    mockQueues.push(this);
  }
}

class MockWorker {
  public readonly waitUntilReady = jest.fn().mockResolvedValue(undefined);
  public readonly close = jest.fn().mockResolvedValue(undefined);
  private readonly listeners = new Map<
    string,
    Array<(...args: unknown[]) => unknown>
  >();

  constructor(
    public readonly name: string,
    public readonly processor: (...args: unknown[]) => Promise<unknown>,
  ) {
    mockWorkers.push(this);
  }

  on(event: string, handler: (...args: unknown[]) => unknown): this {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.listeners.get(event) ?? []) {
      handler(...args);
    }
  }
}

class MockQueueEvents {
  public readonly waitUntilReady = jest.fn().mockResolvedValue(undefined);
  public readonly close = jest.fn().mockResolvedValue(undefined);
  private readonly listeners = new Map<
    string,
    Array<(...args: unknown[]) => unknown>
  >();

  constructor(public readonly name: string) {
    mockQueueEvents.push(this);
  }

  on(event: string, handler: (...args: unknown[]) => unknown): this {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
    return this;
  }

  async emit(event: string, ...args: unknown[]): Promise<void> {
    for (const handler of this.listeners.get(event) ?? []) {
      await handler(...args);
    }
  }
}

jest.mock('bullmq', () => ({
  Queue: jest
    .fn()
    .mockImplementation(
      (name: string, options: unknown) => new MockQueue(name, options),
    ),
  Worker: jest
    .fn()
    .mockImplementation(
      (name: string, processor: (...args: unknown[]) => Promise<unknown>) =>
        new MockWorker(name, processor),
    ),
  QueueEvents: jest
    .fn()
    .mockImplementation((name: string) => new MockQueueEvents(name)),
}));

import { QUEUE_DEFAULT_JOB_OPTIONS } from './queue.constants';
import { QueueAdminNotificationService } from './queue.admin-notification';
import { QueueRegistryService } from './queue.registry';

describe('QueueRegistryService', () => {
  let service: QueueRegistryService;
  let adminNotification: jest.Mocked<
    Pick<QueueAdminNotificationService, 'notifyDeadLetter'>
  >;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockQueues.length = 0;
    mockWorkers.length = 0;
    mockQueueEvents.length = 0;
    adminNotification = {
      notifyDeadLetter: jest.fn().mockResolvedValue(undefined),
    };
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    service = new QueueRegistryService(
      { host: 'localhost', port: 6379, password: undefined },
      adminNotification as unknown as QueueAdminNotificationService,
    );
    await service.onModuleInit();
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('processes a job successfully when a handler is registered', async () => {
    const handler = jest.fn().mockResolvedValue({ ok: true });
    service.registerHandler('email-jobs', handler);

    const worker = mockWorkers.find((entry) => entry.name === 'email-jobs');
    expect(worker).toBeDefined();

    const job = {
      id: 'job-1',
      name: 'send-email',
      data: { to: 'user@example.com' },
      opts: QUEUE_DEFAULT_JOB_OPTIONS,
      attemptsMade: 0,
    };

    await expect(worker!.processor(job)).resolves.toEqual({ ok: true });
    expect(handler).toHaveBeenCalledWith(job);
  });

  it('retries processing when a handler fails before succeeding', async () => {
    const handler = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce({ ok: true });
    service.registerHandler('sms-jobs', handler);

    const worker = mockWorkers.find((entry) => entry.name === 'sms-jobs');
    expect(worker).toBeDefined();

    const job = {
      id: 'job-2',
      name: 'send-sms',
      data: { to: '+2340000000000' },
      opts: QUEUE_DEFAULT_JOB_OPTIONS,
      attemptsMade: 0,
    };

    await expect(worker!.processor(job)).rejects.toThrow('temporary failure');
    await expect(
      worker!.processor({ ...job, attemptsMade: 1 }),
    ).resolves.toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('notifies admins when a job exhausts max retries', async () => {
    const queue = mockQueues.find(
      (entry) => entry.name === 'notification-jobs',
    );
    const queueEvents = mockQueueEvents.find(
      (entry) => entry.name === 'notification-jobs',
    );

    expect(queue).toBeDefined();
    expect(queueEvents).toBeDefined();

    queue!.getJob.mockResolvedValue({
      id: 'job-3',
      name: 'fanout-notification',
      data: { userId: 'admin-1', message: 'boom' },
      opts: { attempts: 3 },
      attemptsMade: 3,
    });

    await queueEvents!.emit('failed', {
      jobId: 'job-3',
      failedReason: 'permanent failure',
    });

    expect(adminNotification.notifyDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        queueName: 'notification-jobs',
        jobId: 'job-3',
        failedReason: 'permanent failure',
        payload: { userId: 'admin-1', message: 'boom' },
      }),
    );
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Dead-lettered BullMQ job'),
    );
  });
});
