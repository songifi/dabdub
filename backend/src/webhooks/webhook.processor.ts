import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from '@nestjs/common';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { DELIVER_WEBHOOK_JOB, WEBHOOKS_QUEUE, WebhookService } from './webhook.service';
import { hmacSha256Hex } from './webhooks.crypto';

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 8 * 60 * 60_000] as const;

@Processor(WEBHOOKS_QUEUE)
export class WebhookProcessor {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,

    @InjectRepository(WebhookSubscription)
    private readonly subscriptionRepo: Repository<WebhookSubscription>,

    @InjectQueue(WEBHOOKS_QUEUE)
    private readonly queue: Queue<{ deliveryId: string }>,

    private readonly webhooks: WebhookService,
  ) {}

  @Process(DELIVER_WEBHOOK_JOB)
  async deliver(job: Job<{ deliveryId: string }>): Promise<void> {
    const deliveryId = job.data?.deliveryId;
    if (!deliveryId) return;

    const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
    if (!delivery) return;

    // Already delivered — ignore duplicates.
    if (delivery.deliveredAt) return;

    const sub = await this.subscriptionRepo.findOne({
      where: { id: delivery.subscriptionId },
    });
    if (!sub || !sub.isActive) return;

    const now = new Date();

    // If scheduled in the future, skip (Bull shouldn't run it early, but be safe).
    if (delivery.nextRetryAt && delivery.nextRetryAt > now) return;

    const payloadJson = JSON.stringify(delivery.payload);
    const rawSecret = this.webhooks.decryptRawSecret(sub);
    const sigHex = hmacSha256Hex(payloadJson, rawSecret);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.webhooks.getDeliveryTimeoutMs());

    try {
      const resp = await fetch(sub.url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Cheese-Event': delivery.event,
          'X-Cheese-Signature': `sha256=${sigHex}`,
          'X-Correlation-Id': (job as any).id?.toString?.() ?? undefined,
        } as any,
        body: payloadJson,
      });

      const bodyText = await safeReadBody(resp);

      delivery.responseStatus = resp.status;
      delivery.responseBody = bodyText ? bodyText.slice(0, 2000) : null;

      if (resp.ok) {
        delivery.deliveredAt = new Date();
        delivery.nextRetryAt = delivery.deliveredAt;
        await this.deliveryRepo.save(delivery);
        this.logger.log(`Delivered webhook deliveryId=${delivery.id} sub=${sub.id} status=${resp.status}`);
        return;
      }

      await this.handleFailure(delivery, sub, `HTTP ${resp.status}`);
    } catch (err: any) {
      delivery.responseStatus = null;
      delivery.responseBody = err instanceof Error ? err.message : String(err);
      await this.handleFailure(delivery, sub, 'network_error');
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleFailure(
    delivery: WebhookDelivery,
    sub: WebhookSubscription,
    reason: string,
  ): Promise<void> {
    delivery.attemptCount += 1;

    if (delivery.attemptCount >= 5) {
      // 5 failed attempts for this delivery => deactivate subscription.
      delivery.nextRetryAt = new Date();
      await this.deliveryRepo.save(delivery);

      this.logger.warn(
        `Webhook failed 5 times; deactivating subscriptionId=${sub.id} deliveryId=${delivery.id} reason=${reason}`,
      );
      await this.webhooks.deactivateAfterFailures(sub.id);
      return;
    }

    const delayMs = RETRY_DELAYS_MS[delivery.attemptCount - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
    delivery.nextRetryAt = new Date(Date.now() + delayMs);
    await this.deliveryRepo.save(delivery);

    // Re-enqueue with explicit delay.
    await this.queue.add(
      DELIVER_WEBHOOK_JOB,
      { deliveryId: delivery.id },
      { delay: delayMs, removeOnComplete: true, removeOnFail: false },
    );

    this.logger.warn(
      `Webhook delivery retry scheduled deliveryId=${delivery.id} sub=${sub.id} attempt=${delivery.attemptCount} in=${delayMs}ms`,
    );
  }
}

async function safeReadBody(resp: Response): Promise<string | null> {
  try {
    const text = await resp.text();
    return text.length ? text : null;
  } catch {
    return null;
  }
}

