import { Injectable, Logger } from "@nestjs/common";
import { Processor, Process, InjectQueue } from "@nestjs/bull";
import { Job, Queue } from "bull";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import axios from "axios";
import * as crypto from "crypto";
import { QueueConfigService } from "../config/queue-config.service";
import {
  WEBHOOK_DELIVERY_JOB,
  WEBHOOK_DELIVERY_QUEUE,
} from "../queue/queue.constants";
import { Webhook } from "./entities/webhook.entity";
import { WebhookDeliveryLog } from "./entities/webhook-delivery-log.entity";

interface WebhookDeliveryJobData {
  webhookId: string;
  merchantId: string;
  url: string;
  secret: string;
  event: string;
  body: string;
  attemptNumber: number;
}

@Injectable()
@Processor(WEBHOOK_DELIVERY_QUEUE)
export class WebhookDeliveryProcessor {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepo: Repository<Webhook>,
    @InjectRepository(WebhookDeliveryLog)
    private readonly deliveryLogRepo: Repository<WebhookDeliveryLog>,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE)
    private readonly webhookQueue: Queue,
    private readonly queueConfig: QueueConfigService,
  ) {}

  @Process(WEBHOOK_DELIVERY_JOB)
  async process(job: Job<WebhookDeliveryJobData>): Promise<void> {
    const data = job.data;
    const requestBody = data.body;
    const signature = this.sign(requestBody, data.secret);
    const headers = {
      "Content-Type": "application/json",
      "x-webhook-signature": signature,
      "x-webhook-event": data.event,
    };

    try {
      const response = await axios.post(data.url, requestBody, {
        headers,
        timeout: 15000,
      });

      await this.logDelivery(data, "success", response.status, undefined, 0);
      await this.markWebhookSuccess(data.webhookId);
    } catch (error) {
      const errorMessage = error?.response?.data
        ? JSON.stringify(error.response.data)
        : (error?.message ?? "Unknown error");
      const responseCode = error?.response?.status ?? null;
      const retrySchedule = this.queueConfig.webhookRetrySchedule;
      const attemptNumber = data.attemptNumber;
      const retryIndex = attemptNumber - 1;
      const nextDelay = retrySchedule[retryIndex] ?? 0;

      await this.logDelivery(
        data,
        "failure",
        responseCode,
        errorMessage,
        nextDelay,
      );
      await this.markWebhookFailure(data.webhookId);

      if (retryIndex + 1 < retrySchedule.length) {
        await this.webhookQueue.add(
          WEBHOOK_DELIVERY_JOB,
          { ...data, attemptNumber: attemptNumber + 1 },
          {
            jobId: `${data.webhookId}:${data.event}:${Date.now()}:${attemptNumber + 1}`,
            delay: nextDelay,
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
      } else {
        this.logger.warn(
          `Webhook delivery exhausted retries for ${data.url} after ${attemptNumber} attempts.`,
        );
      }
    }
  }

  private sign(body: string, secret: string): string {
    return crypto
      .createHmac("sha256", secret ?? "")
      .update(body)
      .digest("hex");
  }

  private async logDelivery(
    data: WebhookDeliveryJobData,
    status: "success" | "failure",
    responseCode?: number,
    error?: string,
    retryDelayMs?: number,
  ) {
    const logEntry = this.deliveryLogRepo.create({
      webhookId: data.webhookId,
      event: data.event,
      requestUrl: data.url,
      requestBody: data.body,
      attemptNumber: data.attemptNumber,
      status,
      responseCode,
      error,
      retryDelayMs: retryDelayMs ?? 0,
    });
    await this.deliveryLogRepo.save(logEntry);
  }

  private async markWebhookSuccess(webhookId: string) {
    const webhook = await this.webhookRepo.findOne({
      where: { id: webhookId },
    });
    if (!webhook) return;

    webhook.lastDeliveredAt = new Date();
    webhook.failureCount = 0;
    await this.webhookRepo.save(webhook);
  }

  private async markWebhookFailure(webhookId: string) {
    const webhook = await this.webhookRepo.findOne({
      where: { id: webhookId },
    });
    if (!webhook) return;

    webhook.failureCount += 1;
    if (webhook.failureCount >= 10) {
      webhook.isActive = false;
    }
    await this.webhookRepo.save(webhook);
  }
}
