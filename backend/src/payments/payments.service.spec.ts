jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { StellarService } from '../stellar/stellar.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MerchantsService } from '../merchants/merchants.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let repo: Repository<Payment>;
  let stellar: StellarService;
  let webhooks: WebhooksService;
  let notifications: NotificationsService;
  let merchants: MerchantsService;

  const mockMerchant = {
    id: 'merchant-123',
    email: 'merchant@example.com',
    businessName: 'Test Merchant',
  };

  const mockPayment = {
    id: 'payment-123',
    merchantId: 'merchant-123',
    reference: 'PAY-123',
    status: PaymentStatus.SETTLED,
    amountUsd: 100,
    amountUsdc: 100,
    customerWalletAddress: 'GDABC...',
    customerEmail: 'customer@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: StellarService,
          useValue: {
            sendPayment: jest.fn(),
            getUsdcAsset: jest.fn(),
          },
        },
        {
          provide: WebhooksService,
          useValue: {
            dispatch: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            enqueueEmail: jest.fn(),
          },
        },
        {
          provide: MerchantsService,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    repo = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    stellar = module.get<StellarService>(StellarService);
    jest.spyOn(stellar, 'getUsdcAsset').mockReturnValue({ code: 'USDC' } as any);
    webhooks = module.get<WebhooksService>(WebhooksService);
    notifications = module.get<NotificationsService>(NotificationsService);
    merchants = module.get<MerchantsService>(MerchantsService);
  });

  describe('refund', () => {
    it('should throw NotFoundException if payment not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      await expect(service.refund('123', 'merchant-123', { reason: 'test' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if payment not settled', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({ ...mockPayment, status: PaymentStatus.PENDING } as any);
      await expect(service.refund('123', 'merchant-123', { reason: 'test' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if customer wallet unknown', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue({ ...mockPayment, customerWalletAddress: null } as any);
      await expect(service.refund('123', 'merchant-123', { reason: 'test' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should successfully process full refund', async () => {
      const payment = { ...mockPayment, status: PaymentStatus.SETTLED };
      jest.spyOn(repo, 'findOne').mockResolvedValue(payment as any);
      jest.spyOn(merchants, 'findOne').mockResolvedValue(mockMerchant as any);
      jest.spyOn(stellar, 'sendPayment').mockResolvedValue('tx-hash-123');
      jest.spyOn(repo, 'save').mockImplementation(async (p) => p as any);

      const result = await service.refund('payment-123', 'merchant-123', { reason: 'Customer return' });

      expect(result.status).toBe(PaymentStatus.REFUNDED);
      expect(result.refundAmountUsd).toBe(100);
      expect(stellar.sendPayment).toHaveBeenCalledWith(
        'GDABC...',
        '100.0000000',
        expect.anything(),
        'REFUND-123',
      );
      expect(webhooks.dispatch).toHaveBeenCalledWith('merchant-123', 'payment.refunded', expect.anything());
      expect(notifications.enqueueEmail).toHaveBeenCalledTimes(2);
    });

    it('should successfully process partial refund', async () => {
      const payment = { ...mockPayment, status: PaymentStatus.SETTLED };
      jest.spyOn(repo, 'findOne').mockResolvedValue(payment as any);
      jest.spyOn(merchants, 'findOne').mockResolvedValue(mockMerchant as any);
      jest.spyOn(stellar, 'sendPayment').mockResolvedValue('tx-hash-123');
      jest.spyOn(repo, 'save').mockImplementation(async (p) => p as any);

      const result = await service.refund('payment-123', 'merchant-123', { amountUsd: 50, reason: 'Partial return' });

      expect(result.status).toBe(PaymentStatus.REFUNDED);
      expect(result.refundAmountUsd).toBe(50);
      expect(stellar.sendPayment).toHaveBeenCalledWith(
        'GDABC...',
        '50.0000000',
        expect.anything(),
        'REFUND-123',
      );
    });
  });
});
