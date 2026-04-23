import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, JobCounts } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AdminAlertService } from '../alerts/admin-alert.service';
import { AdminAlertType } from '../alerts/admin-alert.entity';
import { QUEUE_LIST, QUEUE_NAMES } from './queue.constants';

const DEPTH_ALERT_THRESHOLD = 1_000;

export interface QueueMetric {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

@Injectable()
export class QueueMetricsService {
  private readonly logger = new Logger(QueueMetricsService.name);
  private previousCompleted: Map<string, number> = new Map();

  constructor(
    @InjectQueue(QUEUE_NAMES.settlement) private settlementQ: Queue,
    @InjectQueue(QUEUE_NAMES.webhook) private webhookQ: Queue,
    @InjectQueue(QUEUE_NAMES.notification) private notificationQ: Queue,
    @InjectQueue(QUEUE_NAMES.stellarMonitor) private stellarMonitorQ: Queue,
    private readonly adminAlerts: AdminAlertService,
  ) {}

  private get queues(): Record<string, Queue> {
    return {
      [QUEUE_NAMES.settlement]: this.settlementQ,
      [QUEUE_NAMES.webhook]: this.webhookQ,
      [QUEUE_NAMES.notification]: this.notificationQ,
      [QUEUE_NAMES.stellarMonitor]: this.stellarMonitorQ,
    };
  }

  async getMetrics(): Promise<QueueMetric[]> {
    const results: QueueMetric[] = [];
    for (const name of QUEUE_LIST) {
      const queue = this.queues[name];
      const counts: JobCounts = await queue.getJobCounts();
      results.push({ name, ...counts } as QueueMetric & JobCounts);
    }
    return results;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkThresholds(): Promise<void> {
    const metrics = await this.getMetrics();
    for (const m of metrics) {
      if (m.waiting >= DEPTH_ALERT_THRESHOLD) {
        this.logger.warn(`Queue "${m.name}" depth = ${m.waiting} (threshold: ${DEPTH_ALERT_THRESHOLD})`);
        await this.adminAlerts.raise({
          type: AdminAlertType.STELLAR_MONITOR,
          dedupeKey: `queue.depth.${m.name}`,
          message: `Queue "${m.name}" waiting depth is ${m.waiting}, exceeds threshold of ${DEPTH_ALERT_THRESHOLD}`,
          metadata: { queue: m.name, waiting: m.waiting },
          thresholdValue: DEPTH_ALERT_THRESHOLD,
        });
      }

      const prev = this.previousCompleted.get(m.name) ?? 0;
      if (prev > 0 && m.completed === prev) {
        this.logger.warn(`Queue "${m.name}" processing rate has dropped to zero`);
        await this.adminAlerts.raise({
          type: AdminAlertType.STELLAR_MONITOR,
          dedupeKey: `queue.stalled.${m.name}`,
          message: `Queue "${m.name}" processing rate dropped to zero (completed count unchanged)`,
          metadata: { queue: m.name, completed: m.completed },
          thresholdValue: 0,
        });
      }
      this.previousCompleted.set(m.name, m.completed);
    }
  }
}
