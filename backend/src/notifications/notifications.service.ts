import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import {
  EMAIL_DELIVERY_JOB,
  EMAIL_DELIVERY_QUEUE,
} from "../queue/queue.constants";
import { QueueConfigService } from "../config/queue-config.service";

export interface EmailJobPayload {
  recipient: string;
  subject: string;
  text?: string;
  html?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue(EMAIL_DELIVERY_QUEUE) private readonly emailQueue: Queue,
    private readonly queueConfig: QueueConfigService,
  ) {}

  async enqueueEmail(payload: EmailJobPayload): Promise<void> {
    await this.emailQueue.add(EMAIL_DELIVERY_JOB, payload, {
      attempts: this.queueConfig.emailMaxRetries + 1,
      backoff: { type: "fixed", delay: this.queueConfig.emailRetryDelay },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
