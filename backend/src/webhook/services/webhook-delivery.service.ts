import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { gzipSync } from 'zlib';
import { createHmac, timingSafeEqual, randomUUID } from 'crypto';
import { WebhookConfigurationEntity } from '../../database/entities/webhook-configuration.entity';
import { WebhookEvent, WebhookStatus } from '../../database/entities/webhook-configuration.entity';
import {
  WebhookDeliveryLogEntity,
  WebhookDeliveryStatus,
} from '../../database/entities/webhook-delivery-log.entity';

export interface WebhookDeliveryContext {
  paymentRequestId?: string;
  requestId?: string;
  correlationId?: string;
  traceId?: string;
  userAgent?: string;
  ipAddress?: string;
}

interface WebhookQueueItem {
  webhookConfigId: string;
  event: string;
  payload: unknown;
  context: WebhookDeliveryContext;
}

interface WebhookBatchEntry {
  event: string;
  payload: unknown;
  context?: WebhookDeliveryContext;
}

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  private readonly queue: WebhookQueueItem[] = [];
  private processing = false;
  private readonly batchBuffers = new Map<
    string,
    { entries: WebhookBatchEntry[]; timer?: NodeJS.Timeout }
  >();

  constructor(
    @InjectRepository(WebhookConfigurationEntity)
    private readonly webhookConfigRepository: Repository<WebhookConfigurationEntity>,
    @InjectRepository(WebhookDeliveryLogEntity)
    private readonly deliveryLogRepository: Repository<WebhookDeliveryLogEntity>,
  ) {}

  async enqueueDelivery(
    webhookConfigId: string,
    event: string,
    payload: unknown,
    context: WebhookDeliveryContext = {},
  ): Promise<void> {
    const config = await this.webhookConfigRepository.findOne({
      where: { id: webhookConfigId },
    });
    if (!config || config.status !== WebhookStatus.ACTIVE) {
      return;
    }

    if (!this.isWebhookEvent(event) || !config.events?.includes(event)) {
      return;
    }

    if (config.batchEnabled) {
      this.logger.debug(`Buffering webhook event ${event} for ${config.id}`);
      this.bufferBatch(config, { event, payload, context });
      return;
    }

    this.logger.debug(`Enqueued webhook event ${event} for ${webhookConfigId}`);
    this.queue.push({ webhookConfigId, event, payload, context });
    void this.processQueue();
  }

  async enqueueBatchDelivery(
    webhookConfigId: string,
    entries: WebhookBatchEntry[],
  ): Promise<void> {
    if (!entries.length) {
      return;
    }

    const config = await this.webhookConfigRepository.findOne({
      where: { id: webhookConfigId },
    });
    if (!config || config.status !== WebhookStatus.ACTIVE) {
      return;
    }

    if (!config.batchEnabled) {
      entries.forEach((entry) => {
        this.queue.push({
          webhookConfigId,
          event: entry.event,
          payload: entry.payload,
          context: entry.context ?? {},
        });
      });
      this.logger.debug(
        `Enqueued ${entries.length} webhook events for ${webhookConfigId}`,
      );
      void this.processQueue();
      return;
    }

    const envelope = this.buildBatchEnvelope(entries);
    this.queue.push({
      webhookConfigId,
      event: 'webhook.batch',
      payload: envelope,
      context: {},
    });
    void this.processQueue();
  }

  async deliverWebhook(
    webhookConfigId: string,
    event: string,
    payload: unknown,
    context: WebhookDeliveryContext = {},
  ): Promise<void> {
    const config = await this.webhookConfigRepository.findOne({
      where: { id: webhookConfigId },
    });
    if (!config || config.status !== WebhookStatus.ACTIVE) {
      return;
    }

    if (event !== 'webhook.batch') {
      if (!this.isWebhookEvent(event) || !config.events?.includes(event)) {
        return;
      }
    }

    const maxRetries = Math.max(1, config.maxRetries ?? 1);
    const timeout = Math.min(Math.max(1000, config.timeout ?? 5000), 5000);
    const retryDelay = Math.max(0, config.retryDelay ?? 1000);

    this.logger.debug(
      `Delivering webhook ${event} to ${config.url} (attempts: ${maxRetries})`,
    );

    const envelope =
      event === 'webhook.batch'
        ? payload
        : this.buildEventEnvelope(event, payload, context);
    const payloadString = this.serializePayload(envelope);
    const payloadSnapshot = gzipSync(Buffer.from(payloadString));
    const payloadSnapshotSize = payloadSnapshot.length;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      const deliveryId = randomUUID();
      const signatureHeader = this.createSignatureHeader(
        payloadString,
        config.secret,
      );
      const requestHeaders = this.buildRequestHeaders(
        event,
        signatureHeader,
        deliveryId,
      );

      if (config.headers) {
          Object.assign(requestHeaders, config.headers);
      }

      const log = this.deliveryLogRepository.create({
        id: deliveryId,
        webhookConfigId: config.id,
        paymentRequestId: context.paymentRequestId,
        event,
        payload: envelope,
        status: WebhookDeliveryStatus.PENDING,
        attemptNumber: attempt,
        maxAttempts: maxRetries,
        requestHeaders,
        requestBody: payloadString,
        payloadSnapshot,
        payloadSnapshotEncoding: 'gzip',
        payloadSnapshotSize,
        requestId: context.requestId,
        correlationId: context.correlationId,
        traceId: context.traceId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        debugInfo: signatureHeader ? { signatureHeader } : undefined,
      });

      const startTime = Date.now();
      log.sentAt = new Date();
      log.status = WebhookDeliveryStatus.SENT;

      try {
        const response = await this.sendRequest(
          config.url,
          payloadString,
          timeout,
          requestHeaders,
        );
        log.responseTimeMs = Date.now() - startTime;
        log.httpStatusCode = response.status;
        log.responseHeaders = response.headers;
        log.responseBody = response.body;

        if (response.status >= 200 && response.status < 300) {
          log.status = WebhookDeliveryStatus.DELIVERED;
          log.deliveredAt = new Date();
          await this.deliveryLogRepository.save(log);
          await this.recordSuccess(config);
          this.logger.log(`Webhook ${event} delivered to ${config.id}`);
          return;
        }

        log.status = WebhookDeliveryStatus.FAILED;
        log.failedAt = new Date();
        log.errorMessage = `Non-2xx response: ${response.status}`;
      } catch (error) {
        log.status = WebhookDeliveryStatus.FAILED;
        log.failedAt = new Date();
        log.errorMessage = (error as Error).message;
      }

      if (attempt < maxRetries) {
        log.nextRetryAt = new Date(
          Date.now() + this.calculateBackoffDelay(retryDelay, attempt),
        );
      }

      await this.deliveryLogRepository.save(log);
      await this.recordFailure(config, log.errorMessage ?? 'Delivery failed');

      if (config.status !== WebhookStatus.ACTIVE) {
        this.logger.warn(`Webhook ${config.id} disabled during retry cycle.`);
        return;
      }

      if (attempt < maxRetries) {
        await this.sleep(this.calculateBackoffDelay(retryDelay, attempt));
      }
    }

    this.logger.warn(
      `Webhook delivery failed after ${maxRetries} attempts for ${config.id}`,
    );
  }

  async replayDelivery(deliveryLogId: string): Promise<void> {
    const log = await this.deliveryLogRepository.findOne({
      where: { id: deliveryLogId },
    });
    if (!log) {
      return;
    }

    await this.enqueueDelivery(log.webhookConfigId, log.event, log.payload, {
      paymentRequestId: log.paymentRequestId,
      requestId: log.requestId,
      correlationId: log.correlationId,
      traceId: log.traceId,
      userAgent: log.userAgent,
      ipAddress: log.ipAddress,
    });
  }

  verifySignature(
    payloadString: string,
    secret: string | undefined,
    signatureHeader: string,
  ): boolean {
    if (!secret) {
      return false;
    }
    const parsed = this.parseSignatureHeader(signatureHeader);
    if (!parsed) {
      return false;
    }

    const expected = this.signPayload(payloadString, secret, parsed.timestamp);
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(parsed.signature, 'hex');
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
  }

  serializePayloadForVerification(payload: unknown): string {
    return this.serializePayload(payload);
  }

  private async sendRequest(
    url: string,
    body: string,
    timeoutMs: number,
    requestHeaders: Record<string, string>,
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    body: string;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body,
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const responseBody = await response.text();

      return {
        status: response.status,
        headers: responseHeaders,
        body: responseBody,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }
    this.processing = true;
    while (this.queue.length) {
      const item = this.queue.shift();
      if (!item) {
        continue;
      }
      await this.deliverWebhook(
        item.webhookConfigId,
        item.event,
        item.payload,
        item.context,
      );
    }
    this.processing = false;
  }

  private bufferBatch(
    config: WebhookConfigurationEntity,
    entry: WebhookBatchEntry,
  ): void {
    const buffer = this.batchBuffers.get(config.id) ?? { entries: [] };
    buffer.entries.push(entry);

    if (buffer.entries.length >= (config.batchMaxSize ?? 20)) {
      void this.flushBatch(config.id);
      return;
    }

    if (!buffer.timer) {
      const batchWindowMs = Number(config.batchWindowMs ?? 2000);
      buffer.timer = setTimeout(() => {
        void this.flushBatch(config.id);
      }, batchWindowMs);
    }

    this.batchBuffers.set(config.id, buffer);
  }

  private async flushBatch(webhookConfigId: string): Promise<void> {
    const buffer = this.batchBuffers.get(webhookConfigId);
    if (!buffer || !buffer.entries.length) {
      return;
    }

    if (buffer.timer) {
      clearTimeout(buffer.timer);
    }
    this.batchBuffers.delete(webhookConfigId);

    const config = await this.webhookConfigRepository.findOne({
      where: { id: webhookConfigId },
    });
    if (!config || config.status !== WebhookStatus.ACTIVE) {
      return;
    }

    const envelope = this.buildBatchEnvelope(buffer.entries);
    this.logger.debug(
      `Flushing batch of ${buffer.entries.length} events for ${webhookConfigId}`,
    );
    this.queue.push({
      webhookConfigId,
      event: 'webhook.batch',
      payload: envelope,
      context: {},
    });
    void this.processQueue();
  }

  private buildEventEnvelope(
    event: string,
    payload: unknown,
    context: WebhookDeliveryContext,
  ): Record<string, unknown> {
    return {
      id: `evt_${randomUUID()}`,
      event,
      createdAt: new Date().toISOString(),
      data: payload ?? {},
      context,
    };
  }

  private buildBatchEnvelope(
    entries: WebhookBatchEntry[],
  ): Record<string, unknown> {
    return {
      id: `batch_${randomUUID()}`,
      type: 'batch',
      createdAt: new Date().toISOString(),
      events: entries.map((entry) =>
        this.buildEventEnvelope(
          entry.event,
          entry.payload,
          entry.context ?? {},
        ),
      ),
    };
  }

  private serializePayload(payload: unknown): string {
    return JSON.stringify(payload, this.stableJsonReplacer());
  }

  private stableJsonReplacer(): (key: string, value: unknown) => unknown {
    return (_key, value) => {
      if (this.isPlainObject(value)) {
        const sortedKeys = Object.keys(value).sort();
        return sortedKeys.reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = value[key];
          return acc;
        }, {});
      }
      return value;
    };
  }

  private buildRequestHeaders(
    event: string,
    signatureHeader: string | null,
    deliveryId: string,
  ): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'Dabdub-Webhook/1.0',
      'X-Dabdub-Event': event,
      'X-Dabdub-Delivery': deliveryId,
      ...(signatureHeader ? { 'X-Dabdub-Signature': signatureHeader } : {}),
    };
  }

  private createSignatureHeader(
    payloadString: string,
    secret?: string,
  ): string | null {
    if (!secret) {
      return null;
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.signPayload(payloadString, secret, timestamp);
    return `t=${timestamp},v1=${signature}`;
  }

  private signPayload(
    payloadString: string,
    secret: string,
    timestamp: number,
  ): string {
    return createHmac('sha256', secret)
      .update(`${timestamp}.${payloadString}`)
      .digest('hex');
  }

  private parseSignatureHeader(
    header: string,
  ): { timestamp: number; signature: string } | null {
    const parts = header.split(',').map((part) => part.trim());
    const timestampPart = parts.find((part) => part.startsWith('t='));
    const signaturePart = parts.find((part) => part.startsWith('v1='));
    if (!timestampPart || !signaturePart) {
      return null;
    }
    const timestamp = Number(timestampPart.replace('t=', ''));
    const signature = signaturePart.replace('v1=', '');
    if (!Number.isFinite(timestamp) || !signature) {
      return null;
    }
    return { timestamp, signature };
  }

  private calculateBackoffDelay(baseDelay: number, attempt: number): number {
    const exponential = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.floor(Math.random() * 250);
    return exponential + jitter;
  }

  private async recordFailure(
    config: WebhookConfigurationEntity,
    reason: string,
  ): Promise<void> {
    const currentFailures = Number(config.consecutiveFailures ?? 0);
    config.consecutiveFailures = currentFailures + 1;
    config.lastFailureAt = new Date();

    if (
      config.maxConsecutiveFailures &&
      config.consecutiveFailures >= config.maxConsecutiveFailures
    ) {
      config.status = WebhookStatus.FAILED;
      config.disabledAt = new Date();
      config.disabledReason = reason;
      this.logger.warn(
        `Disabling webhook ${config.id} after ${config.consecutiveFailures} consecutive failures.`,
      );
    }

    await this.webhookConfigRepository.save(config);
  }

  private async recordSuccess(
    config: WebhookConfigurationEntity,
  ): Promise<void> {
    config.consecutiveFailures = 0;
    config.lastDeliveredAt = new Date();
    config.lastFailureAt = undefined;
    await this.webhookConfigRepository.save(config);
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private isWebhookEvent(event: string): event is WebhookEvent {
    return (Object.values(WebhookEvent) as string[]).includes(event);
  }

  protected async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
