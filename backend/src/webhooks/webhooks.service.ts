import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import axios from 'axios';
import { Webhook } from './entities/webhook.entity';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(Webhook)
    private webhooksRepo: Repository<Webhook>,
  ) {}

  async dispatch(merchantId: string, event: string, payload: Record<string, any>): Promise<void> {
    const webhooks = await this.webhooksRepo.find({
      where: { merchantId, isActive: true },
    });

    const matchingWebhooks = webhooks.filter(
      (w) => w.events.includes(event) || w.events.includes('*'),
    );

    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });

    for (const webhook of matchingWebhooks) {
      const signature = this.sign(body, webhook.secret);
      try {
        await axios.post(webhook.url, body, {
          headers: {
            'Content-Type': 'application/json',
            'X-CheesePay-Signature': signature,
            'X-CheesePay-Event': event,
          },
          timeout: 10000,
        });

        webhook.lastDeliveredAt = new Date();
        webhook.failureCount = 0;
        await this.webhooksRepo.save(webhook);
      } catch (err) {
        this.logger.warn(`Webhook delivery failed to ${webhook.url}: ${err.message}`);
        webhook.failureCount += 1;
        if (webhook.failureCount >= 10) webhook.isActive = false;
        await this.webhooksRepo.save(webhook);
      }
    }
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

  private sign(body: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }
}
