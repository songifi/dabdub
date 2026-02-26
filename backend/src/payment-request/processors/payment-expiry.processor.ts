import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PaymentRequestRepository } from '../repositories/payment-request.repository';
import { PaymentRequestStatus } from '../../database/entities/payment-request.entity';
import { WebhookDeliveryService } from '../../webhook/services/webhook-delivery.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookConfigurationEntity } from '../../database/entities/webhook-configuration.entity';

export const PAYMENT_EXPIRY_QUEUE = 'payment-expiry';

interface PaymentExpiryJobData {
  paymentRequestId: string;
}

@Processor(PAYMENT_EXPIRY_QUEUE, { concurrency: 10 })
export class PaymentExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentExpiryProcessor.name);

  constructor(
    private readonly paymentRequestRepository: PaymentRequestRepository,
    private readonly webhookDeliveryService: WebhookDeliveryService,
    @InjectRepository(WebhookConfigurationEntity)
    private readonly webhookConfigRepository: Repository<WebhookConfigurationEntity>,
  ) {
    super();
  }

  async process(job: Job<PaymentExpiryJobData>): Promise<void> {
    const { paymentRequestId } = job.data;

    const paymentRequest =
      await this.paymentRequestRepository.findById(paymentRequestId);

    if (!paymentRequest) {
      this.logger.warn(`Payment request ${paymentRequestId} not found`);
      return;
    }

    if (paymentRequest.status !== PaymentRequestStatus.PENDING) {
      this.logger.debug(
        `Payment request ${paymentRequestId} already ${paymentRequest.status}`,
      );
      return;
    }

    const statusHistory = paymentRequest.statusHistory || [];
    statusHistory.push({
      status: PaymentRequestStatus.EXPIRED,
      timestamp: new Date().toISOString(),
      reason: 'TTL elapsed',
    });

    await this.paymentRequestRepository.update(paymentRequestId, {
      status: PaymentRequestStatus.EXPIRED,
      statusHistory,
    });

    this.logger.log(`Payment request ${paymentRequestId} marked as EXPIRED`);

    const webhookConfig = await this.webhookConfigRepository.findOne({
      where: { merchantId: paymentRequest.merchantId },
    });

    if (webhookConfig) {
      await this.webhookDeliveryService.enqueueDelivery(
        webhookConfig.id,
        'payment.expired',
        {
          id: paymentRequest.id,
          merchantId: paymentRequest.merchantId,
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          status: PaymentRequestStatus.EXPIRED,
          expiresAt: paymentRequest.expiresAt,
          createdAt: paymentRequest.createdAt,
        },
        { paymentRequestId },
      );
    }
  }
}
