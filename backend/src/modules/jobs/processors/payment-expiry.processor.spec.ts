import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { PaymentExpiryProcessor } from './payment-expiry.processor';
import { PaymentRequestRepository } from '../../../payment-request/repositories/payment-request.repository';
import { WebhookService } from '../../../webhook/services/webhook.service';
import { RedisService } from '../../../common/redis';
import {
  PaymentRequestStatus,
} from '../../../database/entities/payment-request.entity';
import { WebhookEvent } from '../../../database/entities/webhook-configuration.entity';
import { PaymentExpiryJobPayload } from '../payloads';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockPaymentRequest = {
  id: 'req-uuid-001',
  merchantId: 'merchant-uuid-001',
  amount: 100,
  currency: 'USDC',
  status: PaymentRequestStatus.PENDING,
  expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  statusHistory: [
    { status: PaymentRequestStatus.PENDING, timestamp: new Date().toISOString() },
  ],
  metadata: null,
};

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockRepository = {
  findById: jest.fn(),
  update: jest.fn(),
};

const mockWebhookService = {
  publishEvent: jest.fn().mockResolvedValue(undefined),
};

const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
};

// ─── Mock Job ────────────────────────────────────────────────────────────────

const createMockJob = (data: PaymentExpiryJobPayload): Partial<Job> => ({
  id: 'job-123',
  data,
  updateProgress: jest.fn(),
});

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('PaymentExpiryProcessor', () => {
  let processor: PaymentExpiryProcessor;
  let repository: PaymentRequestRepository;
  let webhookService: WebhookService;
  let redisService: RedisService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentExpiryProcessor,
        { provide: PaymentRequestRepository, useValue: mockRepository },
        { provide: WebhookService, useValue: mockWebhookService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    processor = module.get<PaymentExpiryProcessor>(PaymentExpiryProcessor);
    repository = module.get<PaymentRequestRepository>(PaymentRequestRepository);
    webhookService = module.get<WebhookService>(WebhookService);
    redisService = module.get<RedisService>(RedisService);
  });

  describe('process', () => {
    const jobPayload: PaymentExpiryJobPayload = {
      paymentRequestId: 'req-uuid-001',
      merchantId: 'merchant-uuid-001',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    it('should mark payment as expired and fire webhook when payment is still pending', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null); // Not idempotent
      mockRepository.findById.mockResolvedValue({ ...mockPaymentRequest });
      mockRepository.update.mockResolvedValue({
        ...mockPaymentRequest,
        status: PaymentRequestStatus.EXPIRED,
      });

      const job = createMockJob(jobPayload) as Job<PaymentExpiryJobPayload>;

      // Act
      const result = await processor.process(job as Job<PaymentExpiryJobPayload>);

      // Assert
      expect(result.status).toBe(PaymentRequestStatus.EXPIRED);
      expect(mockRepository.update).toHaveBeenCalledWith(
        jobPayload.paymentRequestId,
        expect.objectContaining({
          status: PaymentRequestStatus.EXPIRED,
        }),
      );
      expect(mockWebhookService.publishEvent).toHaveBeenCalledWith(
        WebhookEvent.PAYMENT_REQUEST_EXPIRED,
        expect.objectContaining({
          paymentRequestId: jobPayload.paymentRequestId,
          status: PaymentRequestStatus.EXPIRED,
        }),
        expect.objectContaining({
          paymentRequestId: jobPayload.paymentRequestId,
        }),
      );
    });

    it('should skip expiry when payment request is not found', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);
      mockRepository.findById.mockResolvedValue(null);

      const job = createMockJob(jobPayload) as Job<PaymentExpiryJobPayload>;

      // Act
      const result = await processor.process(job as Job<PaymentExpiryJobPayload>);

      // Assert
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('payment_request_not_found');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should skip expiry when payment is already processed', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);
      mockRepository.findById.mockResolvedValue({
        ...mockPaymentRequest,
        status: PaymentRequestStatus.COMPLETED,
      });

      const job = createMockJob(jobPayload) as Job<PaymentExpiryJobPayload>;

      // Act
      const result = await processor.process(job as Job<PaymentExpiryJobPayload>);

      // Assert
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('not_pending');
      expect(mockRepository.update).not.toHaveBeenCalled();
      expect(mockWebhookService.publishEvent).not.toHaveBeenCalled();
    });

    it('should skip expiry when already processed (idempotent)', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue('1'); // Already processed

      const job = createMockJob(jobPayload) as Job<PaymentExpiryJobPayload>;

      // Act
      const result = await processor.process(job as Job<PaymentExpiryJobPayload>);

      // Assert
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('idempotent');
      expect(mockRepository.findById).not.toHaveBeenCalled();
    });

    it('should skip expiry when payment is cancelled', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);
      mockRepository.findById.mockResolvedValue({
        ...mockPaymentRequest,
        status: PaymentRequestStatus.CANCELLED,
      });

      const job = createMockJob(jobPayload) as Job<PaymentExpiryJobPayload>;

      // Act
      const result = await processor.process(job as Job<PaymentExpiryJobPayload>);

      // Assert
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('not_pending');
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should handle webhook failure gracefully', async () => {
      // Arrange
      mockRedisService.get.mockResolvedValue(null);
      mockRepository.findById.mockResolvedValue({ ...mockPaymentRequest });
      mockRepository.update.mockResolvedValue({
        ...mockPaymentRequest,
        status: PaymentRequestStatus.EXPIRED,
      });
      mockWebhookService.publishEvent.mockRejectedValue(
        new Error('Webhook delivery failed'),
      );

      const job = createMockJob(jobPayload) as Job<PaymentExpiryJobPayload>;

      // Act
      const result = await processor.process(job as Job<PaymentExpiryJobPayload>);

      // Assert
      // Should still mark as expired even if webhook fails
      expect(result.status).toBe(PaymentRequestStatus.EXPIRED);
      expect(mockRepository.update).toHaveBeenCalled();
    });
  });
});
