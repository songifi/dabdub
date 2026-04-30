import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as Sentry from '@sentry/nestjs';
import { SorobanMonitorService } from './soroban-monitor.service';
import { StellarService } from './stellar.service';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { AdminAlertService } from '../alerts/admin-alert.service';
import { AdminAlertType } from '../alerts/admin-alert.entity';

jest.mock('@sentry/nestjs', () => ({
  captureException: jest.fn(),
}));

const mockPaymentsRepo = () => ({
  find: jest.fn(),
  save: jest.fn(),
});

const mockAdminAlerts = () => ({
  raise: jest.fn(),
});

const mockStellarService = () => ({
  queryContractBalance: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === 'SOROBAN_RPC_URL') return 'https://soroban-testnet.stellar.org';
    if (key === 'SOROBAN_ESCROW_CONTRACT_ID') return 'CONTRACT_ID_TEST';
    return fallback;
  }),
});

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'payment-uuid-1',
    reference: 'PAY-001',
    merchantId: 'merchant-1',
    amountUsd: 25,
    amountUsdc: 25,
    amountXlm: null,
    status: PaymentStatus.PENDING,
    stellarMemo: 'MEMO1',
    metadata: { escrowPaymentId: 'escrow-id-abc' },
    ...overrides,
  } as Payment;
}

describe('SorobanMonitorService – balance verification', () => {
  let service: SorobanMonitorService;
  let paymentsRepo: jest.Mocked<Repository<Payment>>;
  let adminAlerts: jest.Mocked<AdminAlertService>;
  let stellar: jest.Mocked<StellarService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanMonitorService,
        { provide: getRepositoryToken(Payment), useFactory: mockPaymentsRepo },
        { provide: AdminAlertService, useFactory: mockAdminAlerts },
        { provide: StellarService, useFactory: mockStellarService },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get(SorobanMonitorService);
    paymentsRepo = module.get(getRepositoryToken(Payment));
    adminAlerts = module.get(AdminAlertService);
    stellar = module.get(StellarService);

    jest.clearAllMocks();
  });

  // ── Helper: drive pollEscrowEvents with a synthetic deposit event ──────────

  function buildDepositEvent(escrowPaymentId: string, eventId = 'evt-1') {
    return {
      type: 'contract',
      ledger: 100,
      ledgerClosedAt: '2024-01-01T00:00:00Z',
      contractId: 'CONTRACT_ID_TEST',
      id: eventId,
      pagingToken: eventId,
      topic: ['ESCROW', 'deposit'],
      value: { payment_id: escrowPaymentId, amount: '250000000' },
    };
  }

  async function driveWithEvent(payment: Payment, event: ReturnType<typeof buildDepositEvent>) {
    paymentsRepo.find.mockResolvedValue([payment]);

    // Patch getEvents to return our synthetic event
    (service as any).escrowContractId = 'CONTRACT_ID_TEST';
    jest
      .spyOn(service as any, 'getEvents')
      .mockResolvedValue({ events: [event], latestLedger: 101 });

    await service.pollEscrowEvents();
  }

  // ── Tests ──────────────────────────────────────────────────────────────────

  it('confirms payment when on-chain balance equals expected amount', async () => {
    const payment = makePayment({ amountUsdc: 25 }); // 25 USDC = 250_000_000 stroops
    stellar.queryContractBalance.mockResolvedValue(BigInt(250_000_000));

    await driveWithEvent(payment, buildDepositEvent('escrow-id-abc'));

    expect(paymentsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.CONFIRMED }),
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(adminAlerts.raise).not.toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: expect.stringContaining('short-paid') }),
    );
  });

  it('confirms payment when on-chain balance exceeds expected amount (over-paid)', async () => {
    const payment = makePayment({ amountUsdc: 25 });
    stellar.queryContractBalance.mockResolvedValue(BigInt(300_000_000)); // more than expected

    await driveWithEvent(payment, buildDepositEvent('escrow-id-abc'));

    expect(paymentsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.CONFIRMED }),
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('rejects confirmation and reports to Sentry when balance is less than expected', async () => {
    const payment = makePayment({ amountUsdc: 25 }); // expects 250_000_000 stroops
    stellar.queryContractBalance.mockResolvedValue(BigInt(100_000_000)); // short-paid

    await driveWithEvent(payment, buildDepositEvent('escrow-id-abc'));

    // Payment must NOT be confirmed
    expect(paymentsRepo.save).not.toHaveBeenCalled();

    // Sentry must be notified
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    const sentryError: Error = (Sentry.captureException as jest.Mock).mock.calls[0][0];
    expect(sentryError.message).toContain('Short-paid deposit detected');
    expect(sentryError.message).toContain('PAY-001');
    expect(sentryError.message).toContain('expected=250000000');
    expect(sentryError.message).toContain('on-chain=100000000');
    expect(sentryError.message).toContain('shortfall=150000000');

    // Admin alert must be raised
    expect(adminAlerts.raise).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AdminAlertType.STELLAR_MONITOR,
        dedupeKey: `soroban-monitor.short-paid:${payment.id}`,
      }),
    );
  });

  it('rejects confirmation when balance is zero (no funds received)', async () => {
    const payment = makePayment({ amountUsdc: 10 });
    stellar.queryContractBalance.mockResolvedValue(BigInt(0));

    await driveWithEvent(payment, buildDepositEvent('escrow-id-abc'));

    expect(paymentsRepo.save).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('proceeds without verification when queryContractBalance returns null (RPC unavailable)', async () => {
    const payment = makePayment({ amountUsdc: 25 });
    stellar.queryContractBalance.mockResolvedValue(null);

    await driveWithEvent(payment, buildDepositEvent('escrow-id-abc'));

    // Should still confirm — transient RPC failure must not block confirmation
    expect(paymentsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.CONFIRMED }),
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('does not run balance check for non-deposit events (release)', async () => {
    const payment = makePayment({ status: PaymentStatus.CONFIRMED, amountUsdc: 25 });
    stellar.queryContractBalance.mockResolvedValue(BigInt(0)); // would fail if called

    paymentsRepo.find.mockResolvedValue([payment]);
    (service as any).escrowContractId = 'CONTRACT_ID_TEST';
    jest.spyOn(service as any, 'getEvents').mockResolvedValue({
      events: [
        {
          type: 'contract',
          ledger: 100,
          ledgerClosedAt: '2024-01-01T00:00:00Z',
          contractId: 'CONTRACT_ID_TEST',
          id: 'evt-release-1',
          pagingToken: 'evt-release-1',
          topic: ['ESCROW', 'release'],
          value: { payment_id: 'escrow-id-abc', amount: '250000000' },
        },
      ],
      latestLedger: 101,
    });

    await service.pollEscrowEvents();

    // Balance query must not be called for release events
    expect(stellar.queryContractBalance).not.toHaveBeenCalled();
    expect(paymentsRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: PaymentStatus.SETTLED }),
    );
  });

  it('deduplicates events — does not process the same event twice', async () => {
    const payment = makePayment({ amountUsdc: 25 });
    stellar.queryContractBalance.mockResolvedValue(BigInt(250_000_000));

    const event = buildDepositEvent('escrow-id-abc', 'evt-dup-1');

    paymentsRepo.find.mockResolvedValue([payment]);
    (service as any).escrowContractId = 'CONTRACT_ID_TEST';
    const getEventsSpy = jest
      .spyOn(service as any, 'getEvents')
      .mockResolvedValue({ events: [event], latestLedger: 101 });

    await service.pollEscrowEvents();
    await service.pollEscrowEvents();

    // save called only once despite two polls
    expect(paymentsRepo.save).toHaveBeenCalledTimes(1);
    expect(getEventsSpy).toHaveBeenCalledTimes(2);
  });
});
