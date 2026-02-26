import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PaymentRequestService } from '../src/payment-request/payment-request.service';
import { PaymentRequestRepository } from '../src/payment-request/repositories/payment-request.repository';
import { ExpirationSchedulerService } from '../src/payment-request/services/expiration-scheduler.service';
import { PaymentExpiryProcessor } from '../src/payment-request/processors/payment-expiry.processor';
import { WebhookDeliveryService } from '../src/webhook/services/webhook-delivery.service';
import {
  PaymentRequest,
  PaymentRequestStatus,
} from '../src/database/entities/payment-request.entity';
import { Merchant } from '../src/database/entities/merchant.entity';
import { WebhookConfigurationEntity } from '../src/database/entities/webhook-configuration.entity';
import { PAYMENT_EXPIRY_QUEUE } from '../src/payment-request/processors/payment-expiry.processor';

describe('Payment Expiry Flow (e2e)', () => {
  let app: INestApplication;
  let paymentRequestService: PaymentRequestService;
  let paymentRequestRepository: PaymentRequestRepository;
  let expirationScheduler: ExpirationSchedulerService;
  let processor: PaymentExpiryProcessor;
  let webhookDeliveryService: WebhookDeliveryService;
  let expiryQueue: Queue;
  let merchantRepo: Repository<Merchant>;
  let webhookConfigRepo: Repository<WebhookConfigurationEntity>;

  const mockMerchant = {
    id: 'test-merchant-id',
    name: 'Test Merchant',
    email: 'test@merchant.com',
  };

  const mockWebhookConfig = {
    id: 'test-webhook-id',
    merchantId: 'test-merchant-id',
    url: 'https://example.com/webhook',
    events: ['payment.expired'],
    status: 'active',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRequestService,
        PaymentRequestRepository,
        ExpirationSchedulerService,
        PaymentExpiryProcessor,
        WebhookDeliveryService,
        {
          provide: getRepositoryToken(PaymentRequest),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockMerchant),
          },
        },
        {
          provide: getRepositoryToken(WebhookConfigurationEntity),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockWebhookConfig),
          },
        },
        {
          provide: getQueueToken(PAYMENT_EXPIRY_QUEUE),
          useValue: {
            add: jest.fn(),
            getJob: jest.fn(),
            clean: jest.fn(),
          },
        },
        {
          provide: 'GlobalConfigService',
          useValue: {
            getStellarConfig: jest.fn().mockReturnValue({
              defaultExpirationMinutes: 15,
              minPaymentAmount: 1,
              maxPaymentAmount: 10000,
              activeNetwork: 'testnet',
            }),
          },
        },
        {
          provide: 'QrCodeService',
          useValue: {},
        },
        {
          provide: 'StellarContractService',
          useValue: {},
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    paymentRequestService = moduleFixture.get(PaymentRequestService);
    paymentRequestRepository = moduleFixture.get(PaymentRequestRepository);
    expirationScheduler = moduleFixture.get(ExpirationSchedulerService);
    processor = moduleFixture.get(PaymentExpiryProcessor);
    webhookDeliveryService = moduleFixture.get(WebhookDeliveryService);
    expiryQueue = moduleFixture.get(getQueueToken(PAYMENT_EXPIRY_QUEUE));
    merchantRepo = moduleFixture.get(getRepositoryToken(Merchant));
    webhookConfigRepo = moduleFixture.get(
      getRepositoryToken(WebhookConfigurationEntity),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Job enqueued at payment creation', () => {
    it('should schedule expiry job with correct delay', async () => {
      const expiresAt = new Date(Date.now() + 5000);
      const paymentRequestId = 'test-payment-id';

      await expirationScheduler.scheduleExpiry(paymentRequestId, expiresAt);

      expect(expiryQueue.add).toHaveBeenCalledWith(
        'expire',
        { paymentRequestId },
        expect.objectContaining({
          jobId: paymentRequestId,
          delay: expect.any(Number),
        }),
      );
    });

    it('should process immediately if already expired', async () => {
      const expiresAt = new Date(Date.now() - 1000);
      const paymentRequestId = 'expired-payment-id';

      await expirationScheduler.scheduleExpiry(paymentRequestId, expiresAt);

      expect(expiryQueue.add).toHaveBeenCalledWith(
        'expire',
        { paymentRequestId },
        { jobId: paymentRequestId },
      );
    });
  });

  describe('Job handler marks payment as EXPIRED', () => {
    it('should update status to EXPIRED and emit webhook', async () => {
      const paymentRequest = {
        id: 'test-payment-id',
        merchantId: 'test-merchant-id',
        amount: 100,
        currency: 'USDC',
        status: PaymentRequestStatus.PENDING,
        statusHistory: [],
        expiresAt: new Date(),
        createdAt: new Date(),
      };

      jest
        .spyOn(paymentRequestRepository, 'findById')
        .mockResolvedValue(paymentRequest as PaymentRequest);
      jest
        .spyOn(paymentRequestRepository, 'update')
        .mockResolvedValue({} as PaymentRequest);
      jest
        .spyOn(webhookDeliveryService, 'enqueueDelivery')
        .mockResolvedValue();

      await processor.process({
        data: { paymentRequestId: 'test-payment-id' },
      } as any);

      expect(paymentRequestRepository.update).toHaveBeenCalledWith(
        'test-payment-id',
        expect.objectContaining({
          status: PaymentRequestStatus.EXPIRED,
          statusHistory: expect.arrayContaining([
            expect.objectContaining({
              status: PaymentRequestStatus.EXPIRED,
              reason: 'TTL elapsed',
            }),
          ]),
        }),
      );

      expect(webhookDeliveryService.enqueueDelivery).toHaveBeenCalledWith(
        'test-webhook-id',
        'payment.expired',
        expect.objectContaining({
          id: 'test-payment-id',
          status: PaymentRequestStatus.EXPIRED,
        }),
        { paymentRequestId: 'test-payment-id' },
      );
    });

    it('should not update if payment already processed', async () => {
      const paymentRequest = {
        id: 'completed-payment-id',
        status: PaymentRequestStatus.COMPLETED,
      };

      jest
        .spyOn(paymentRequestRepository, 'findById')
        .mockResolvedValue(paymentRequest as PaymentRequest);
      jest.spyOn(paymentRequestRepository, 'update');

      await processor.process({
        data: { paymentRequestId: 'completed-payment-id' },
      } as any);

      expect(paymentRequestRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('Job cancellation on payment confirmation', () => {
    it('should cancel expiry job when payment is confirmed', async () => {
      const mockJob = { remove: jest.fn() };
      jest.spyOn(expiryQueue, 'getJob').mockResolvedValue(mockJob as any);

      await expirationScheduler.cancelExpiry('test-payment-id');

      expect(expiryQueue.getJob).toHaveBeenCalledWith('test-payment-id');
      expect(mockJob.remove).toHaveBeenCalled();
    });
  });

  describe('Stale job cleanup', () => {
    it('should clean jobs older than 24 hours', async () => {
      jest.spyOn(expiryQueue, 'clean').mockResolvedValue([]);

      await expirationScheduler.cleanStaleJobs();

      expect(expiryQueue.clean).toHaveBeenCalledWith(
        expect.any(Number),
        100,
        'completed',
      );
      expect(expiryQueue.clean).toHaveBeenCalledWith(
        expect.any(Number),
        100,
        'failed',
      );
    });
  });
});
