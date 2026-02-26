import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import type { PaymentExpiryJobPayload } from '../payloads';
import { PaymentRequestRepository } from '../../../payment-request/repositories/payment-request.repository';
import {
  PaymentRequestStatus,
  PaymentRequest,
} from '../../../database/entities/payment-request.entity';
import { WebhookService } from '../../../webhook/services/webhook.service';
import { WebhookEvent } from '../../../database/entities/webhook-configuration.entity';
import { RedisService } from '../../../common/redis';

const QUEUE = 'payment-expiry';
const IDEMPOTENCY_PREFIX = 'job:processed:payment-expiry:';

interface PaymentExpiredWebhookPayload {
  id: string;
  paymentRequestId: string;
  merchantId: string;
  amount: number;
  currency: string;
  status: PaymentRequestStatus;
  expiresAt: string;
  expiredAt: string;
  metadata?: Record<string, unknown>;
}

@Processor(QUEUE)
export class PaymentExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentExpiryProcessor.name);

  constructor(
    private readonly paymentRequestRepository: PaymentRequestRepository,
    private readonly webhookService: WebhookService,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  async process(
    job: Job<PaymentExpiryJobPayload, unknown, string>,
  ): Promise<unknown> {
    const { paymentRequestId } = job.data;
    const idempotencyKey = `${IDEMPOTENCY_PREFIX}${paymentRequestId}`;

    // Check idempotency first
    const alreadyProcessed = await this.isIdempotencyProcessed(idempotencyKey);
    if (alreadyProcessed) {
      this.logger.log(
        `Payment expiry for ${paymentRequestId} already processed (idempotent skip)`,
      );
      return { skipped: true, reason: 'idempotent' };
    }

    // Fetch the payment request
    const paymentRequest = await this.paymentRequestRepository.findById(
      paymentRequestId,
    );

    if (!paymentRequest) {
      this.logger.warn(
        `Payment request ${paymentRequestId} not found - may have been deleted`,
      );
      // Mark as processed to avoid retry
      await this.markIdempotencyProcessed(idempotencyKey);
      return { skipped: true, reason: 'payment_request_not_found' };
    }

    // Check if payment is still pending - if not, it was already processed or cancelled
    if (
      paymentRequest.status !== PaymentRequestStatus.PENDING &&
      paymentRequest.status !== PaymentRequestStatus.PROCESSING
    ) {
      this.logger.log(
        `Payment ${paymentRequestId} is no longer pending (status: ${paymentRequest.status}) - skipping expiry`,
      );
      // Mark as idempotent to avoid processing again
      await this.markIdempotencyProcessed(idempotencyKey);
      return { skipped: true, reason: 'not_pending' };
    }

    this.logger.log(
      `Processing payment expiry for ${paymentRequestId}`,
    );

    // Update status to EXPIRED
    const now = new Date().toISOString();
    const statusHistory = paymentRequest.statusHistory || [];
    statusHistory.push({
      status: PaymentRequestStatus.EXPIRED,
      timestamp: now,
      reason: 'Payment request expired - no deposit received within TTL',
    });

    await this.paymentRequestRepository.update(paymentRequestId, {
      status: PaymentRequestStatus.EXPIRED,
      statusHistory,
    });

    // Fire webhook event
    const webhookPayload: PaymentExpiredWebhookPayload = {
      id: `evt_${Date.now()}_${paymentRequestId.slice(0, 8)}`,
      paymentRequestId: paymentRequest.id,
      merchantId: paymentRequest.merchantId,
      amount: Number(paymentRequest.amount),
      currency: paymentRequest.currency,
      status: PaymentRequestStatus.EXPIRED,
      expiresAt: paymentRequest.expiresAt?.toISOString() || '',
      expiredAt: now,
      metadata: paymentRequest.metadata,
    };

    try {
      await this.webhookService.publishEvent(
        WebhookEvent.PAYMENT_REQUEST_EXPIRED,
        webhookPayload,
        {
          paymentRequestId: paymentRequest.id,
        },
      );
      this.logger.log(
        `Published payment.expired webhook for ${paymentRequestId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish payment.expired webhook for ${paymentRequestId}`,
        error,
      );
    }

    // Mark as idempotent
    await this.markIdempotencyProcessed(idempotencyKey);

    return {
      paymentRequestId,
      status: PaymentRequestStatus.EXPIRED,
      expiredAt: now,
    };
  }

  private async isIdempotencyProcessed(key: string): Promise<boolean> {
    const result = await this.redisService.get(key);
    return result === '1';
  }

  private async markIdempotencyProcessed(key: string): Promise<void> {
    // Store for 24 hours
    await this.redisService.set(key, '1', 86400);
  }
}
