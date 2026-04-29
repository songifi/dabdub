import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SorobanMonitorService } from '../stellar/soroban-monitor.service';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { AdminAlertService } from '../alerts/admin-alert.service';

describe('SorobanMonitorService (integration)', () => {
  let module: TestingModule;
  let service: SorobanMonitorService;
  const payments: Payment[] = [];
  const repo = {
    find: jest.fn(async () => payments),
    save: jest.fn(async (payment: Payment) => payment),
  };
  const originalFetch = (global as any).fetch;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        SorobanMonitorService,
        { provide: getRepositoryToken(Payment), useValue: repo },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) => {
              if (key === 'SOROBAN_RPC_URL') return 'https://soroban-testnet.stellar.org';
              if (key === 'SOROBAN_ESCROW_CONTRACT_ID') return 'ESCROW_CONTRACT';
              return defaultValue ?? '';
            },
          },
        },
        {
          provide: AdminAlertService,
          useValue: { raise: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(SorobanMonitorService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    (global as any).fetch = originalFetch;
    payments.splice(0, payments.length);
    repo.find.mockClear();
    repo.save.mockClear();
  });

  afterAll(async () => {
    await module.close();
  });

  it('maps escrow release event to SETTLED payment status', async () => {
    const payment = {
      id: 'payment-1',
      reference: 'PAY-001',
      status: PaymentStatus.CONFIRMED,
      metadata: { escrowPaymentId: 'escrow-pay-1' },
    } as unknown as Payment;
    payments.push(payment);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          latestLedger: 12345,
          events: [
            {
              id: 'evt-1',
              topic: ['ESCROW', 'release'],
              value: { payment_id: 'escrow-pay-1', amount: '10000000' },
            },
          ],
        },
      }),
    });
    (global as any).fetch = fetchMock;

    await service.pollEscrowEvents();

    expect(payment.status).toBe(PaymentStatus.SETTLED);
    expect(repo.save).toHaveBeenCalledWith(payment);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
