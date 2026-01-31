import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookConfigurationEntity, WebhookStatus } from '../../database/entities/webhook-configuration.entity';
import { CreateWebhookDto } from '../dto/webhook.dto';
import { randomUUID } from 'crypto';
import {
  WebhookDeliveryService,
  WebhookDeliveryContext,
} from './webhook-delivery.service';
import {
  WebhookDeliveryLogEntity,
  WebhookDeliveryStatus,
} from '../../database/entities/webhook-delivery-log.entity';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookConfigurationEntity)
    private readonly webhookRepository: Repository<WebhookConfigurationEntity>,
    @InjectRepository(WebhookDeliveryLogEntity)
    private readonly deliveryLogRepository: Repository<WebhookDeliveryLogEntity>,
    private readonly webhookDeliveryService: WebhookDeliveryService,
  ) {}

  async create(createWebhookDto: CreateWebhookDto): Promise<any> {
    // Validate webhook URL is reachable
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(createWebhookDto.url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      if (!response.ok && response.status !== 404) {
        throw new BadRequestException('Webhook URL is not reachable');
      }
    } catch (error) {
      throw new BadRequestException(
        'Webhook URL validation failed: ' + (error as Error).message,
      );
    } finally {
      clearTimeout(timeout);
    }

    const webhook = this.webhookRepository.create({
      id: `wh_${randomUUID()}`,
      url: createWebhookDto.url,
      events: createWebhookDto.events,
      secret: createWebhookDto.secret,
      status: createWebhookDto.status ?? WebhookStatus.ACTIVE,
      headers: createWebhookDto.headers,
      maxRetries: createWebhookDto.maxRetries ?? 3,
      retryDelay: createWebhookDto.retryDelay ?? 1000,
      timeout: Math.min(createWebhookDto.timeout ?? 5000, 5000),
      batchEnabled: createWebhookDto.batchEnabled ?? false,
      batchMaxSize: createWebhookDto.batchMaxSize ?? 20,
      batchWindowMs: createWebhookDto.batchWindowMs ?? 2000,
      consecutiveFailures: 0,
      maxConsecutiveFailures: createWebhookDto.maxConsecutiveFailures ?? 5,
    });

    return this.webhookRepository.save(webhook);
  }

  async findAll(): Promise<WebhookConfigurationEntity[]> {
    return this.webhookRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<WebhookConfigurationEntity> {
    const webhook = await this.webhookRepository.findOne({ where: { id } });
    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }
    return webhook;
  }

  async update(
    id: string,
    updateWebhookDto: CreateWebhookDto,
  ): Promise<WebhookConfigurationEntity> {
    const webhook = await this.findOne(id);

    if (updateWebhookDto.url) {
      webhook.url = updateWebhookDto.url;
    }
    if (updateWebhookDto.events) {
      webhook.events = updateWebhookDto.events;
    }
    if (updateWebhookDto.secret !== undefined) {
      webhook.secret = updateWebhookDto.secret;
    }
    if (updateWebhookDto.status !== undefined) {
      webhook.status = updateWebhookDto.status;
    }
    if (updateWebhookDto.headers !== undefined) {
      webhook.headers = updateWebhookDto.headers;
    }
    if (updateWebhookDto.maxRetries !== undefined) {
      webhook.maxRetries = updateWebhookDto.maxRetries;
    }
    if (updateWebhookDto.retryDelay !== undefined) {
      webhook.retryDelay = updateWebhookDto.retryDelay;
    }
    if (updateWebhookDto.timeout !== undefined) {
      webhook.timeout = Math.min(updateWebhookDto.timeout, 5000);
    }
    if (updateWebhookDto.batchEnabled !== undefined) {
      webhook.batchEnabled = updateWebhookDto.batchEnabled;
    }
    if (updateWebhookDto.batchMaxSize !== undefined) {
      webhook.batchMaxSize = updateWebhookDto.batchMaxSize;
    }
    if (updateWebhookDto.batchWindowMs !== undefined) {
      webhook.batchWindowMs = updateWebhookDto.batchWindowMs;
    }
    if (updateWebhookDto.maxConsecutiveFailures !== undefined) {
        webhook.maxConsecutiveFailures = updateWebhookDto.maxConsecutiveFailures;
    }


    webhook.updatedAt = new Date();
    return this.webhookRepository.save(webhook);
  }

  async delete(id: string): Promise<void> {
    const webhook = await this.findOne(id);
    await this.webhookRepository.remove(webhook);
  }

  async incrementFailureCount(id: string): Promise<void> {
    await this.webhookRepository.increment({ id }, 'consecutiveFailures', 1);
  }

  async resetFailureCount(id: string): Promise<void> {
    await this.webhookRepository.update(
      { id },
      { consecutiveFailures: 0, lastDeliveredAt: new Date() },
    );
  }

  async publishEvent(
    event: string,
    payload: unknown,
    context: WebhookDeliveryContext = {},
  ): Promise<void> {
    const activeWebhooks = await this.webhookRepository.find({
      where: { status: WebhookStatus.ACTIVE },
    });
    const targets = activeWebhooks.filter((config) =>
      config.events?.includes(event as any),
    );

    await Promise.all(
      targets.map((config) =>
        this.webhookDeliveryService.enqueueDelivery(
          config.id,
          event,
          payload,
          context,
        ),
      ),
    );
  }

  async publishEventsBatch(
    events: Array<{
      event: string;
      payload: unknown;
      context?: WebhookDeliveryContext;
    }>,
  ): Promise<void> {
    if (!events.length) {
      return;
    }

    const activeWebhooks = await this.webhookRepository.find({
      where: { status: WebhookStatus.ACTIVE },
    });
    const byWebhook = new Map<
      string,
      Array<{
        event: string;
        payload: unknown;
        context?: WebhookDeliveryContext;
      }>
    >();

    for (const entry of events) {
      for (const config of activeWebhooks) {
        if (!config.events?.includes(entry.event as any)) {
          continue;
        }
        const bucket = byWebhook.get(config.id) ?? [];
        bucket.push(entry);
        byWebhook.set(config.id, bucket);
      }
    }

    await Promise.all(
      Array.from(byWebhook.entries()).map(([webhookId, bucket]) =>
        this.webhookDeliveryService.enqueueBatchDelivery(webhookId, bucket),
      ),
    );
  }

  async getDeliveryAnalytics(webhookConfigId: string): Promise<{
    total: number;
    delivered: number;
    failed: number;
    avgResponseTimeMs: number;
    lastDeliveredAt?: Date;
  }> {
    const [total, delivered, failed] = await Promise.all([
      this.deliveryLogRepository.count({ where: { webhookConfigId } }),
      this.deliveryLogRepository.count({
        where: { webhookConfigId, status: WebhookDeliveryStatus.DELIVERED },
      }),
      this.deliveryLogRepository.count({
        where: { webhookConfigId, status: WebhookDeliveryStatus.FAILED },
      }),
    ]);

    const avgResult = await this.deliveryLogRepository
      .createQueryBuilder('log')
      .select('AVG(log.responseTimeMs)', 'avg')
      .where('log.webhookConfigId = :webhookConfigId', { webhookConfigId })
      .getRawOne<{ avg: string | null }>();

    const lastDeliveredLog = await this.deliveryLogRepository.findOne({
      where: { webhookConfigId, status: WebhookDeliveryStatus.DELIVERED },
      order: { deliveredAt: 'DESC' },
    });

    const avgResponseTimeMs = avgResult?.avg
      ? Math.round(Number(avgResult.avg))
      : 0;

    this.logger.debug(`Webhook analytics computed for ${webhookConfigId}`);

    return {
      total,
      delivered,
      failed,
      avgResponseTimeMs,
      lastDeliveredAt: lastDeliveredLog?.deliveredAt,
    };
  }
}
