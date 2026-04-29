import { ConfigService } from '@nestjs/config';
import { SettlementsService } from './settlements.service';
import { Settlement, SettlementStatus } from './entities/settlement.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { AdminAlertService } from '../alerts/admin-alert.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { CacheService } from '../cache/cache.service';
import { EmailService } from '../email/email.service';
import { MerchantsService } from '../merchants/merchants.service';
import { NotificationPrefsService } from '../notifications/notification-prefs.service';
import { StellarService } from '../stellar/stellar.service';

describe('SettlementsService batching', () => {
  let service: SettlementsService;
  let settlementsRepo: any;
  let paymentsRepo: any;
  let settlementQueue: any;

  const deps = () => ({
    config: { get: jest.fn() } as unknown as ConfigService,
    webhooks: { dispatch: jest.fn().mockResolvedValue(undefined) } as unknown as WebhooksService,
    adminAlerts: {
      raise: jest.fn().mockResolvedValue(null),
    } as unknown as AdminAlertService,
    cache: { delPattern: jest.fn().mockResolvedValue(undefined) } as unknown as CacheService,
    emailService: { queue: jest.fn().mockResolvedValue(undefined) } as unknown as EmailService,
    merchantsService: { findOne: jest.fn().mockResolvedValue({ email: 'merchant@example.com' }) } as unknown as MerchantsService,
    notificationPrefs: { isEnabled: jest.fn().mockResolvedValue(false) } as unknown as NotificationPrefsService,
    stellar: {
      invokeContract: jest.fn().mockResolvedValue('mock-contract-hash'),
    } as unknown as StellarService,
  });

  beforeEach(() => {
    settlementsRepo = {
      create: jest.fn((input) => ({ id: 'settlement-1', ...input } as Settlement)),
      save: jest.fn(async (settlement: Settlement) => settlement),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };

    paymentsRepo = {
      save: jest.fn(async (payment: Payment) => payment),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    settlementQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    service = new SettlementsService(
      settlementsRepo as any,
      paymentsRepo as any,
      deps().config,
      deps().webhooks,
      deps().adminAlerts,
      deps().cache,
      deps().emailService,
      deps().merchantsService,
      deps().notificationPrefs,
      deps().stellar,
      settlementQueue as any,
    );

    jest.restoreAllMocks();
  });

  it('keeps sub-$10 confirmed payments out of immediate settlement', async () => {
    const payment = {
      id: 'payment-small',
      merchantId: 'merchant-1',
      amountUsd: 5,
      status: PaymentStatus.CONFIRMED,
    } as Payment;

    await service.initiateSettlement(payment);

    expect(settlementsRepo.create).not.toHaveBeenCalled();
    expect(settlementQueue.add).not.toHaveBeenCalled();
    expect(payment.status).toBe(PaymentStatus.CONFIRMED);
  });

  it('batches confirmed small payments per merchant once the threshold is reached', async () => {
    const now = new Date('2026-04-27T10:00:00Z');
    jest.spyOn(global.Date, 'now').mockReturnValue(now.getTime());

    const payments = [
      {
        id: 'p1',
        merchantId: 'merchant-1',
        amountUsd: 4,
        status: PaymentStatus.CONFIRMED,
        confirmedAt: new Date('2026-04-27T09:56:00Z'),
        createdAt: new Date('2026-04-27T09:56:00Z'),
      },
      {
        id: 'p2',
        merchantId: 'merchant-1',
        amountUsd: 3,
        status: PaymentStatus.CONFIRMED,
        confirmedAt: new Date('2026-04-27T09:57:00Z'),
        createdAt: new Date('2026-04-27T09:57:00Z'),
      },
      {
        id: 'p3',
        merchantId: 'merchant-1',
        amountUsd: 3.5,
        status: PaymentStatus.CONFIRMED,
        confirmedAt: new Date('2026-04-27T09:58:00Z'),
        createdAt: new Date('2026-04-27T09:58:00Z'),
      },
      {
        id: 'p4',
        merchantId: 'merchant-2',
        amountUsd: 2,
        status: PaymentStatus.CONFIRMED,
        confirmedAt: new Date('2026-04-27T09:59:00Z'),
        createdAt: new Date('2026-04-27T09:59:00Z'),
      },
    ] as Payment[];

    paymentsRepo.find = jest.fn().mockResolvedValue(payments);

    await service.batchSmallConfirmedPayments();

    expect(settlementsRepo.create).toHaveBeenCalledTimes(1);
    expect(settlementsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-1',
        totalAmountUsd: 10.5,
        feeAmountUsd: 10.5 * 0.015,
        netAmountUsd: 10.5 - 10.5 * 0.015,
        fiatCurrency: 'NGN',
        status: SettlementStatus.PROCESSING,
        requiresApproval: false,
      }),
    );
    expect(paymentsRepo.save).toHaveBeenCalledTimes(3);
    expect(settlementQueue.add).toHaveBeenCalledTimes(1);
    expect(settlementQueue.add).toHaveBeenCalledWith('dispatch', { settlementId: 'settlement-1' });
    expect((payments[0] as Payment).status).toBe(PaymentStatus.SETTLING);
    expect((payments[1] as Payment).status).toBe(PaymentStatus.SETTLING);
    expect((payments[2] as Payment).status).toBe(PaymentStatus.SETTLING);
    expect((payments[3] as Payment).status).toBe(PaymentStatus.CONFIRMED);
  });

  it('does not flush a merchant batch that is still below the $10 threshold', async () => {
    const payments = [
      {
        id: 'p1',
        merchantId: 'merchant-1',
        amountUsd: 4,
        status: PaymentStatus.CONFIRMED,
        confirmedAt: new Date('2026-04-27T09:55:00Z'),
        createdAt: new Date('2026-04-27T09:55:00Z'),
      },
      {
        id: 'p2',
        merchantId: 'merchant-1',
        amountUsd: 5,
        status: PaymentStatus.CONFIRMED,
        confirmedAt: new Date('2026-04-27T09:56:00Z'),
        createdAt: new Date('2026-04-27T09:56:00Z'),
      },
    ] as Payment[];

    paymentsRepo.find = jest.fn().mockResolvedValue(payments);

    await service.batchSmallConfirmedPayments();

    expect(settlementsRepo.create).not.toHaveBeenCalled();
    expect(settlementQueue.add).not.toHaveBeenCalled();
    expect(paymentsRepo.save).not.toHaveBeenCalled();
  });
});
