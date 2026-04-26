import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Webhook } from './entities/webhook.entity';
import { WebhookDeliveryService } from './webhook-delivery.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Webhook)
    private webhooksRepo: Repository<Webhook>,
    private deliveryService: WebhookDeliveryService,
  ) {}

  async dispatch(merchantId: string, event: string, payload: Record<string, any>): Promise<void> {
    const webhooks = await this.webhooksRepo.find({
      where: { merchantId, isActive: true },
    });

    const matching = webhooks.filter(
      (w) => w.events.includes(event) || w.events.includes('*'),
    );

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

    await Promise.all(
      matching.map((webhook) => this.deliveryService.enqueueDelivery(webhook, event, body)),
    );

    this.logger.log(`Enqueued ${matching.length} webhook job(s) for event=${event} merchantId=${merchantId}`);
  }

  async create(merchantId: string, url: string, events: string[], secret?: string) {
    const webhook = this.webhooksRepo.create({
      merchantId,
      url,
      events,
      secret: secret ?? crypto.randomBytes(24).toString('hex'),
    });
    return this.webhooksRepo.save(webhook);
  }

  async findAll(merchantId: string) {
    return this.webhooksRepo.find({ where: { merchantId } });
  }

  async remove(id: string, merchantId: string) {
    const webhook = await this.webhooksRepo.findOne({ where: { id, merchantId } });
    if (webhook) await this.webhooksRepo.remove(webhook);
  }
}
