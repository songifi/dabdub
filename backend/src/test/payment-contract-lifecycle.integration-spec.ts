import { PaymentStatus } from '../payments/entities/payment.entity';
import { PaymentsService } from '../payments/payments.service';
import { SettlementsService } from '../settlements/settlements.service';
import { StellarMonitorService } from '../stellar/stellar-monitor.service';

describe('Payment contract lifecycle integration', () => {
  it('invokes create, confirm, settle and expire contract operations', async () => {
    const now = new Date('2026-04-28T10:00:00.000Z');
    const createSpy = jest
      .spyOn(global.Date, 'now')
      .mockReturnValue(now.getTime());

    const paymentRepo = {
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => input),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'payment-expire-1',
            reference: 'PAY-EXPIRE-1',
            merchantId: 'merchant-1',
            status: PaymentStatus.PENDING,
          },
        ]),
      }),
    };

    const settlementsRepo = {
      create: jest.fn((input) => ({ id: 'settlement-1', ...input })),
      save: jest.fn(async (input) => input),
      findOne: jest.fn(),
    };

    const stellar = {
      getXlmUsdRate: jest.fn().mockResolvedValue(0.1),
      generateMemo: jest.fn().mockReturnValue('TESTMEMO'),
      getDepositAddress: jest.fn().mockReturnValue('GTESTADDRESS'),
      invokeContract: jest.fn().mockResolvedValue('mock-contract-tx-hash'),
      getAccountTransactions: jest.fn().mockResolvedValue([]),
      verifyPayment: jest.fn().mockResolvedValue({ verified: false }),
    };

    const webhooks = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };

    const settlementsService = new SettlementsService(
      settlementsRepo as any,
      paymentRepo as any,
      { get: jest.fn() } as any,
      webhooks as any,
      { raise: jest.fn().mockResolvedValue(undefined) } as any,
      { delPattern: jest.fn().mockResolvedValue(undefined) } as any,
      { queue: jest.fn().mockResolvedValue(undefined) } as any,
      { findOne: jest.fn().mockResolvedValue({ email: 'merchant@example.com' }) } as any,
      { isEnabled: jest.fn().mockResolvedValue(false) } as any,
      stellar as any,
      { add: jest.fn().mockResolvedValue(undefined) } as any,
    );

    const paymentsService = new PaymentsService(
      paymentRepo as any,
      stellar as any,
      webhooks as any,
      { enqueueEmail: jest.fn().mockResolvedValue(undefined) } as any,
      { findOne: jest.fn().mockResolvedValue({ email: 'merchant@example.com' }) } as any,
    );

    const monitor = new StellarMonitorService(
      paymentRepo as any,
      { raise: jest.fn().mockResolvedValue(undefined) } as any,
      stellar as any,
      settlementsService as any,
      webhooks as any,
      { queue: jest.fn().mockResolvedValue(undefined) } as any,
      { get: jest.fn().mockReturnValue('http://localhost:3000') } as any,
      { isEnabled: jest.fn().mockResolvedValue(false) } as any,
      { pollTransferEvents: jest.fn().mockResolvedValue(undefined) } as any,
      { add: jest.fn().mockResolvedValue(undefined) } as any,
    );

    const created = await paymentsService.create('merchant-1', {
      amountUsd: 100,
      description: 'contract lifecycle',
    });
    settlementsRepo.findOne.mockResolvedValue({
      id: 'settlement-1',
      merchantId: 'merchant-1',
      payments: [
        {
          id: created.id,
          amountUsd: 100,
          status: PaymentStatus.CONFIRMED,
        },
      ],
    });

    await (monitor as any).confirmPayment(
      created,
      'tx-confirm-1',
      100,
      'USDC',
      'GCLIENT',
    );

    await settlementsService.handlePartnerCallback({
      reference: 'settlement-1',
      status: 'success',
    });

    await (monitor as any).expireOldPayments();

    expect(stellar.invokeContract).toHaveBeenCalledWith(
      'create',
      expect.arrayContaining([created.id, 'merchant-1']),
    );
    expect(stellar.invokeContract).toHaveBeenCalledWith(
      'confirm',
      [created.id, 'tx-confirm-1', 100, 'USDC', 'GCLIENT'],
    );
    expect(stellar.invokeContract).toHaveBeenCalledWith(
      'settle',
      [created.id, 'settlement-1'],
    );
    expect(stellar.invokeContract).toHaveBeenCalledWith(
      'expire',
      ['payment-expire-1'],
    );

    createSpy.mockRestore();
  });
});
