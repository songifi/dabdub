import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import type { ConfigType } from '@nestjs/config';
import { jwtConfig } from '../config/jwt.config';
import { WebhookSubscription } from './entities/webhook-subscription.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import type { WebhookEvent } from './webhooks.events';
import { WEBHOOK_EVENTS } from './webhooks.events';
import {
  decryptAes256Gcm,
  derive32ByteKeyFromString,
  encryptAes256Gcm,
  sha256Hex,
} from './webhooks.crypto';
import { NotificationService } from '../notifications/notifications.service';

export const WEBHOOKS_QUEUE = 'webhooks';
export const DELIVER_WEBHOOK_JOB = 'deliver-webhook';

const DELIVERY_TIMEOUT_MS = 10_000;

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly encKey: Buffer;

  constructor(
    @InjectRepository(WebhookSubscription)
    private readonly subscriptionRepo: Repository<WebhookSubscription>,

    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,

    @InjectQueue(WEBHOOKS_QUEUE)
    private readonly queue: Queue<{ deliveryId: string }>,

    @Inject(jwtConfig.KEY)
    jwt: ConfigType<typeof jwtConfig>,

    private readonly notifications: NotificationService,
  ) {
    // Optional override; otherwise derive from existing required JWT secret.
    const base = process.env['WEBHOOK_SECRET_ENC_KEY'] || jwt.accessSecret;
    this.encKey = derive32ByteKeyFromString(base);
  }

  // ── Subscriptions ────────────────────────────────────────────────────────────

  async createSubscription(
    userId: string,
    url: string,
    events: WebhookEvent[],
  ): Promise<{ subscription: WebhookSubscription; secretOnce: string }> {
    const normalizedUrl = this.validateHttpsUrl(url);
    this.validateEvents(events);

    const secretOnce = cryptoRandomHex(32);
    const secretHash = sha256Hex(secretOnce);
    const secretEnc = encryptAes256Gcm(secretOnce, this.encKey);

    const subscription = this.subscriptionRepo.create({
      userId,
      url: normalizedUrl,
      events,
      secret: secretHash,
      secretEnc,
      isActive: true,
    });
    const saved = await this.subscriptionRepo.save(subscription);

    return { subscription: saved, secretOnce };
  }

  async listSubscriptions(userId: string): Promise<WebhookSubscription[]> {
    return this.subscriptionRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async deactivateSubscription(userId: string, id: string): Promise<void> {
    const sub = await this.subscriptionRepo.findOne({ where: { id, userId } });
    if (!sub) throw new NotFoundException('Webhook subscription not found');
    sub.isActive = false;
    await this.subscriptionRepo.save(sub);
  }

  async listDeliveries(
    userId: string,
    subscriptionId: string,
  ): Promise<WebhookDelivery[]> {
    const sub = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId, userId },
    });
    if (!sub) throw new NotFoundException('Webhook subscription not found');

    return this.deliveryRepo.find({
      where: { subscriptionId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  async redeliver(
    userId: string,
    subscriptionId: string,
    deliveryId?: string,
  ): Promise<WebhookDelivery> {
    const sub = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId, userId },
    });
    if (!sub) throw new NotFoundException('Webhook subscription not found');

    let source: WebhookDelivery | null = null;
    if (deliveryId) {
      source = await this.deliveryRepo.findOne({
        where: { id: deliveryId, subscriptionId },
      });
    } else {
      source = await this.deliveryRepo.findOne({
        where: { subscriptionId },
        order: { createdAt: 'DESC' },
      });
    }
    if (!source) throw new NotFoundException('Webhook delivery not found');

    const delivery = this.deliveryRepo.create({
      subscriptionId,
      event: source.event,
      payload: source.payload,
      responseStatus: null,
      responseBody: null,
      attemptCount: 0,
      deliveredAt: null,
      nextRetryAt: new Date(),
    });
    const saved = await this.deliveryRepo.save(delivery);

    await this.queue.add(
      DELIVER_WEBHOOK_JOB,
      { deliveryId: saved.id },
      { removeOnComplete: true, removeOnFail: false },
    );

    return saved;
  }

  // ── Dispatch ────────────────────────────────────────────────────────────────

  async dispatch(
    event: WebhookEvent,
    payload: Record<string, unknown>,
    userId?: string,
  ): Promise<number> {
    if (!WEBHOOK_EVENTS.includes(event)) {
      throw new BadRequestException(`Invalid webhook event: ${event}`);
    }

    const where: Partial<WebhookSubscription> & { isActive: boolean } = {
      isActive: true,
    };

    const candidates = await this.subscriptionRepo.find({
      where: userId ? { ...where, userId } : where,
      order: { createdAt: 'DESC' },
    });

    const matching = candidates.filter((s) => (s.events ?? []).includes(event));
    if (matching.length === 0) return 0;

    for (const sub of matching) {
      const delivery = this.deliveryRepo.create({
        subscriptionId: sub.id,
        event,
        payload,
        responseStatus: null,
        responseBody: null,
        attemptCount: 0,
        deliveredAt: null,
        nextRetryAt: new Date(), // immediately eligible
      });
      const saved = await this.deliveryRepo.save(delivery);

      await this.queue.add(
        DELIVER_WEBHOOK_JOB,
        { deliveryId: saved.id },
        { removeOnComplete: true, removeOnFail: false },
      );
    }

    this.logger.log(
      `Dispatched webhook event="${event}" count=${matching.length}`,
    );
    return matching.length;
  }

  // ── Worker helpers ─────────────────────────────────────────────────────────

  getDeliveryTimeoutMs(): number {
    return DELIVERY_TIMEOUT_MS;
  }

  decryptRawSecret(subscription: WebhookSubscription): string {
    return decryptAes256Gcm(subscription.secretEnc, this.encKey);
  }

  async deactivateAfterFailures(subscriptionId: string): Promise<void> {
    const sub = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });
    if (!sub) return;

    if (sub.isActive) {
      sub.isActive = false;
      await this.subscriptionRepo.save(sub);

      await this.notifications.create(
        sub.userId,
        'system',
        'Webhook subscription deactivated',
        `Your webhook subscription was deactivated after repeated delivery failures.`,
        { subscriptionId: sub.id, url: sub.url },
      );
    }
  }

  validateHttpsUrl(input: string): string {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw new BadRequestException('Invalid URL');
    }
    if (url.protocol !== 'https:') {
      throw new BadRequestException('Webhook URL must be https');
    }
    return url.toString();
  }

  private validateEvents(events: WebhookEvent[]): void {
    if (!Array.isArray(events) || events.length === 0) {
      throw new BadRequestException('At least one event is required');
    }
    for (const ev of events) {
      if (!WEBHOOK_EVENTS.includes(ev)) {
        throw new BadRequestException(`Invalid event: ${String(ev)}`);
      }
    }
  }
}

function cryptoRandomHex(bytes: number): string {
  // Lazy import to keep top-level deps minimal.
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.randomBytes(bytes).toString('hex');
}
