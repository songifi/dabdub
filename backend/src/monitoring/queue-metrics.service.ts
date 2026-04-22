import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bull';
import type { Queue } from 'bull';
import { Counter, Gauge, Registry } from 'prom-client';
import { MONITORED_BULL_QUEUES } from './queue.constants';

const REFRESH_MS = 10_000;

@Injectable()
export class QueueMetricsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(QueueMetricsService.name);
  readonly registry = new Registry();

  private readonly waiting: Gauge;
  private readonly active: Gauge;
  private readonly completed: Gauge;
  private readonly failed: Gauge;
  private readonly delayed: Gauge;
  private readonly paused: Gauge;

  private readonly completionsTotal: Counter;
  private readonly failuresTotal: Counter;

  private queues: { name: string; queue: Queue }[] = [];
  private interval?: ReturnType<typeof setInterval>;
  private listenersAttached = false;

  constructor(private readonly moduleRef: ModuleRef) {
    const labelNames = ['queue'] as const;

    this.waiting = new Gauge({
      name: 'bull_queue_jobs_waiting',
      help: 'Bull jobs in waiting state',
      labelNames,
      registers: [this.registry],
    });
    this.active = new Gauge({
      name: 'bull_queue_jobs_active',
      help: 'Bull jobs currently being processed',
      labelNames,
      registers: [this.registry],
    });
    this.completed = new Gauge({
      name: 'bull_queue_jobs_completed',
      help: 'Bull jobs in completed set (Redis retention)',
      labelNames,
      registers: [this.registry],
    });
    this.failed = new Gauge({
      name: 'bull_queue_jobs_failed',
      help: 'Bull jobs in failed set (Redis retention)',
      labelNames,
      registers: [this.registry],
    });
    this.delayed = new Gauge({
      name: 'bull_queue_jobs_delayed',
      help: 'Bull jobs scheduled for later execution',
      labelNames,
      registers: [this.registry],
    });
    this.paused = new Gauge({
      name: 'bull_queue_jobs_paused',
      help: 'Bull jobs in paused state',
      labelNames,
      registers: [this.registry],
    });

    this.completionsTotal = new Counter({
      name: 'bull_queue_job_completions_total',
      help: 'Total Bull jobs completed (event counter, for throughput / rate)',
      labelNames,
      registers: [this.registry],
    });
    this.failuresTotal = new Counter({
      name: 'bull_queue_job_failures_total',
      help: 'Total Bull jobs failed (event counter, for throughput / rate)',
      labelNames,
      registers: [this.registry],
    });
  }

  onApplicationBootstrap(): void {
    this.resolveQueues();
    this.attachEventListeners();
    void this.refreshGauges();
    this.interval = setInterval(() => void this.refreshGauges(), REFRESH_MS);
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval);
  }

  private resolveQueues(): void {
    for (const name of MONITORED_BULL_QUEUES) {
      const token = getQueueToken(name);
      const queue = this.moduleRef.get<Queue>(token, { strict: false });
      if (queue) {
        this.queues.push({ name, queue });
        this.logger.log(`Queue metrics: resolved "${name}"`);
      } else {
        this.logger.warn(`Queue metrics: queue "${name}" not registered — skipping`);
      }
    }
  }

  private attachEventListeners(): void {
    if (this.listenersAttached) return;
    this.listenersAttached = true;
    for (const { name, queue } of this.queues) {
      queue.on('completed', () => {
        this.completionsTotal.labels(name).inc();
      });
      queue.on('failed', () => {
        this.failuresTotal.labels(name).inc();
      });
    }
  }

  private async refreshGauges(): Promise<void> {
    for (const { name, queue } of this.queues) {
      try {
        const c = await queue.getJobCounts();
        this.waiting.labels(name).set(c.waiting ?? 0);
        this.active.labels(name).set(c.active ?? 0);
        this.completed.labels(name).set(c.completed ?? 0);
        this.failed.labels(name).set(c.failed ?? 0);
        this.delayed.labels(name).set(c.delayed ?? 0);
        this.paused.labels(name).set(c.paused ?? 0);
      } catch (err) {
        this.logger.warn(`getJobCounts failed for ${name}: ${(err as Error).message}`);
      }
    }
  }

  async getMetrics(): Promise<string> {
    await this.refreshGauges();
    return this.registry.metrics();
  }
}
