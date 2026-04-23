import {
  Controller,
  Get,
  Post,
  Param,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue, Job } from 'bull';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { QUEUE_LIST, QUEUE_NAMES } from './queue.constants';
import { QueueMetricsService, QueueMetric } from './queue-metrics.service';

const DLQ_ALERT_THRESHOLD = 10;

@ApiTags('admin/queues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/queues')
export class QueueAdminController {
  private readonly logger = new Logger(QueueAdminController.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.settlement) private settlementQ: Queue,
    @InjectQueue(QUEUE_NAMES.webhook) private webhookQ: Queue,
    @InjectQueue(QUEUE_NAMES.notification) private notificationQ: Queue,
    @InjectQueue(QUEUE_NAMES.stellarMonitor) private stellarMonitorQ: Queue,
    private readonly metricsService: QueueMetricsService,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get queue depth and throughput metrics for all queues' })
  async getMetrics(): Promise<QueueMetric[]> {
    return this.metricsService.getMetrics();
  }

  private resolveQueue(name: string): Queue {
    const map: Record<string, Queue> = {
      [QUEUE_NAMES.settlement]: this.settlementQ,
      [QUEUE_NAMES.webhook]: this.webhookQ,
      [QUEUE_NAMES.notification]: this.notificationQ,
      [QUEUE_NAMES.stellarMonitor]: this.stellarMonitorQ,
    };
    const queue = map[name];
    if (!queue) throw new NotFoundException(`Queue "${name}" not found. Valid: ${QUEUE_LIST.join(', ')}`);
    return queue;
  }

  @Get(':name/failed')
  @ApiOperation({ summary: 'List failed (DLQ) jobs for a queue' })
  @ApiParam({ name: 'name', description: 'Queue name', enum: QUEUE_LIST })
  async getFailedJobs(@Param('name') name: string): Promise<{ jobs: object[]; total: number }> {
    const queue = this.resolveQueue(name);
    const jobs: Job[] = await queue.getFailed();
    if (jobs.length >= DLQ_ALERT_THRESHOLD) {
      this.logger.warn(`DLQ alert: queue "${name}" has ${jobs.length} failed jobs (threshold: ${DLQ_ALERT_THRESHOLD})`);
    }
    return { jobs: jobs.map((j) => ({ id: j.id, name: j.name, data: j.data, failedReason: j.failedReason, attemptsMade: j.attemptsMade })), total: jobs.length };
  }

  @Post(':name/failed/:id/retry')
  @ApiOperation({ summary: 'Retry a specific failed job' })
  @ApiParam({ name: 'name', description: 'Queue name', enum: QUEUE_LIST })
  @ApiParam({ name: 'id', description: 'Job ID' })
  async retryFailedJob(@Param('name') name: string, @Param('id') id: string): Promise<{ message: string }> {
    const queue = this.resolveQueue(name);
    const job = await queue.getJob(id);
    if (!job) throw new NotFoundException(`Job "${id}" not found in queue "${name}"`);
    await job.retry();
    this.logger.log(`Retried job "${id}" in queue "${name}"`);
    return { message: `Job "${id}" re-queued successfully` };
  }
}
