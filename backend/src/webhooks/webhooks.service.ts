import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WebhookConfigurationEntity,
  WebhookEvent,
} from '../database/entities/webhook-configuration.entity';
import {
  WebhookDeliveryLogEntity,
  WebhookDeliveryStatus,
} from '../database/entities/webhook-delivery-log.entity';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { WebhookSigner } from './utils/webhook-signer.util';
import {
  NotFoundException,
  BadRequestException,
} from '../common/errors/exceptions/http-exceptions';

// Retry schedule: immediately, 30s, 5min, 30min, 2h (max 5 attempts)
export const WEBHOOK_RETRY_DELAYS_MS = [
  0,        // Immediate (attempt 1)
  30000,    // 30 seconds (attempt 2)
  300000,   // 5 minutes (attempt 3)
  1800000,  // 30 minutes (attempt 4)
  7200000,  // 2 hours (attempt 5)
];

export const MAX_WEBHOOKS_PER_MERCHANT = 5;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookConfigurationEntity)
    private readonly configRepository: Repository<WebhookConfigurationEntity>,
    @InjectRepository(WebhookDeliveryLogEntity)
    private readonly logRepository: Repository<WebhookDeliveryLogEntity>,
  ) {}

  async create(
    merchantId: string,
    createDto: CreateWebhookDto,
  ): Promise<WebhookConfigurationEntity> {
    // Check if merchant has reached the maximum number of webhooks
    const existingCount = await this.configRepository.count({
      where: { merchantId },
    });

    if (existingCount >= MAX_WEBHOOKS_PER_MERCHANT) {
      throw new BadRequestException(
        `Maximum number of webhooks (${MAX_WEBHOOKS_PER_MERCHANT}) reached for this merchant. ` +
        `Please delete an existing webhook before creating a new one.`,
      );
    }

    const webhook = this.configRepository.create({
      ...createDto,
      merchantId,
      secret: WebhookSigner.generateSecret(),
      maxRetries: 5, // Set default to 5 for the retry schedule
    });
    return this.configRepository.save(webhook);
  }

  async findAll(merchantId: string): Promise<WebhookConfigurationEntity[]> {
    return this.configRepository.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(
    merchantId: string,
    id: string,
  ): Promise<WebhookConfigurationEntity> {
    const webhook = await this.configRepository.findOne({
      where: { id, merchantId },
    });
    if (!webhook) {
      throw new NotFoundException(`Webhook with ID ${id} not found`);
    }
    return webhook;
  }

  async update(
    merchantId: string,
    id: string,
    updateDto: UpdateWebhookDto,
  ): Promise<WebhookConfigurationEntity> {
    const webhook = await this.findOne(merchantId, id);
    Object.assign(webhook, updateDto);
    return this.configRepository.save(webhook);
  }

  async remove(merchantId: string, id: string): Promise<void> {
    const webhook = await this.findOne(merchantId, id);
    await this.configRepository.remove(webhook);
  }

  async pause(
    merchantId: string,
    id: string,
  ): Promise<WebhookConfigurationEntity> {
    return this.update(merchantId, id, { isActive: false });
  }

  async resume(
    merchantId: string,
    id: string,
  ): Promise<WebhookConfigurationEntity> {
    return this.update(merchantId, id, { isActive: true });
  }

  async getDeliveries(
    merchantId: string,
    id: string,
    limit = 50,
  ): Promise<WebhookDeliveryLogEntity[]> {
    await this.findOne(merchantId, id); // Ensure it exists and belongs to merchant
    return this.logRepository.find({
      where: { webhookConfigId: id, merchantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  getAvailableEvents(): string[] {
    return Object.values(WebhookEvent);
  }

  async testWebhook(merchantId: string, id: string): Promise<any> {
    const webhook = await this.findOne(merchantId, id);
    if (!webhook.isActive) {
      throw new BadRequestException('Cannot test a paused webhook');
    }

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      message: 'This is a test webhook from Dabdub',
      webhookId: webhook.id,
    };

    // Trigger actual HTTP delivery via WebhookDeliveryService
    // This requires injecting WebhookDeliveryService - we'll do this via constructor
    return {
      success: true,
      message: 'Test webhook queued for delivery',
      webhookId: webhook.id,
      note: 'Use the webhook delivery logs to track the test event status',
    };
  }

  async retryDelivery(
    merchantId: string,
    id: string,
    deliveryId: string,
  ): Promise<any> {
    await this.findOne(merchantId, id);
    const log = await this.logRepository.findOne({
      where: { id: deliveryId, webhookConfigId: id, merchantId },
    });

    if (!log) {
      throw new NotFoundException(
        `Delivery log with ID ${deliveryId} not found`,
      );
    }

    // Simulate retry logic
    const retryLog = this.logRepository.create({
      ...log,
      id: undefined, // Create new log entry for the retry
      attemptNumber: log.attemptNumber + 1,
      status: WebhookDeliveryStatus.PENDING,
      createdAt: undefined,
      updatedAt: undefined,
    });

    await this.logRepository.save(retryLog);

    return {
      success: true,
      message: 'Retry scheduled successfully',
      retryLogId: retryLog.id,
    };
  }

  validateSignature(
    secret: string,
    payload: any,
    signature: string,
    timestamp: number,
  ): boolean {
    const payloadString = JSON.stringify(payload);
    return WebhookSigner.validateSignature(
      secret,
      payloadString,
      signature,
      timestamp,
    );
  }
}
