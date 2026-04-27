jest.mock('uuid', () => ({ v4: () => 'mock-uuid' }));
jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,mock') }));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { StellarService } from '../stellar/stellar.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MerchantsService } from '../merchants/merchants.service';
import { BatchCreatePaymentDto, BatchPaymentItemDto } from './dto/batch-create-payment.dto';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<BatchPaymentItemDto> = {}): BatchPaymentItemDto {
  return {
    amountUsd: 10,
    memo: 'Order #1',
    ...overrides,
  };
}

function makeDto(count: number, overrides: Partial<BatchPaymentItemDto> = {}): BatchCreatePaymentDto {
  return { payments: Array.from({ length: count }, (_, i) => makeItem({ memo: `Order #${i + 1}`, ...overrides })) };
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('PaymentsService — createBatch', () => {
  let service: PaymentsService;
  let repoSave: jest.Mock;
  let repoCreate: jest.Mock;

  beforeEach(async () => {
    repoCreate = jest.fn().mockImplementation((data) => ({ ...data, id: 'mock-uuid' }));
    repoSave = jest.fn().mockImplementation((records) =>
      Promise.resolve(Array.isArray(records) ? records : [records]),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            create: repoCreate,
            save: repoSave,
            findAndCount: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: StellarService,
          useValue: {
            getXlmUsdRate: jest.fn().mockResolvedValue(0.1),
            getDepositAddress: jest.fn().mockReturnValue('GDEPOSITADDR'),
            generateMemo: jest.fn().mockReturnValue('MEMO1234'),
            getUsdcAsset: jest.fn().mockReturnValue({ code: 'USDC' }),
            sendPayment: jest.fn(),
          },
        },
        {
          provide: WebhooksService,
          useValue: { dispatch: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: { enqueueEmail: jest.fn() },
        },
        {
          provide: MerchantsService,
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  // ── Batch sizes ───────────────────────────────────────────────────────────

  it('creates a batch of 1 payment', async () => {
    const result = await service.createBatch('merchant-1', makeDto(1));
    expect(result.count).toBe(1);
    expect(result.paymentIds).toHaveLength(1);
    expect(repoSave).toHaveBeenCalledTimes(1);
    const savedRecords = repoSave.mock.calls[0][0];
    expect(savedRecords).toHaveLength(1);
  });

  it('creates a batch of 10 payments', async () => {
    const result = await service.createBatch('merchant-1', makeDto(10));
    expect(result.count).toBe(10);
    expect(result.paymentIds).toHaveLength(10);
    const savedRecords = repoSave.mock.calls[0][0];
    expect(savedRecords).toHaveLength(10);
  });

  it('creates a batch of 20 payments (max allowed)', async () => {
    const result = await service.createBatch('merchant-1', makeDto(20));
    expect(result.count).toBe(20);
    expect(result.paymentIds).toHaveLength(20);
    const savedRecords = repoSave.mock.calls[0][0];
    expect(savedRecords).toHaveLength(20);
  });

  it('all payments in batch have PENDING status', async () => {
    await service.createBatch('merchant-1', makeDto(5));
    const savedRecords: Payment[] = repoSave.mock.calls[0][0];
    for (const p of savedRecords) {
      expect(p.status).toBe(PaymentStatus.PENDING);
    }
  });

  it('each payment gets the correct merchantId', async () => {
    await service.createBatch('merchant-abc', makeDto(3));
    const savedRecords: Payment[] = repoSave.mock.calls[0][0];
    for (const p of savedRecords) {
      expect(p.merchantId).toBe('merchant-abc');
    }
  });

  it('each payment description matches its memo', async () => {
    const dto = makeDto(3);
    await service.createBatch('merchant-1', dto);
    const savedRecords: Payment[] = repoSave.mock.calls[0][0];
    for (let i = 0; i < savedRecords.length; i++) {
      expect(savedRecords[i].description).toBe(dto.payments[i].memo);
    }
  });

  it('repo.save is called exactly once for the whole batch (atomic)', async () => {
    await service.createBatch('merchant-1', makeDto(10));
    expect(repoSave).toHaveBeenCalledTimes(1);
  });

  // ── Validation: entire batch reverts on any invalid input ─────────────────

  it('reverts entire batch if one item has amountUsd = 0', async () => {
    const dto = makeDto(5);
    dto.payments[2].amountUsd = 0;
    await expect(service.createBatch('merchant-1', dto)).rejects.toThrow(BadRequestException);
    expect(repoSave).not.toHaveBeenCalled();
  });

  it('reverts entire batch if one item has negative amountUsd', async () => {
    const dto = makeDto(5);
    dto.payments[4].amountUsd = -1;
    await expect(service.createBatch('merchant-1', dto)).rejects.toThrow(BadRequestException);
    expect(repoSave).not.toHaveBeenCalled();
  });

  it('reverts entire batch if one item has empty memo', async () => {
    const dto = makeDto(5);
    dto.payments[1].memo = '';
    await expect(service.createBatch('merchant-1', dto)).rejects.toThrow(BadRequestException);
    expect(repoSave).not.toHaveBeenCalled();
  });

  it('reverts entire batch if one item has whitespace-only memo', async () => {
    const dto = makeDto(5);
    dto.payments[3].memo = '   ';
    await expect(service.createBatch('merchant-1', dto)).rejects.toThrow(BadRequestException);
    expect(repoSave).not.toHaveBeenCalled();
  });

  it('error message includes the failing item index', async () => {
    const dto = makeDto(5);
    dto.payments[2].amountUsd = 0;
    await expect(service.createBatch('merchant-1', dto)).rejects.toThrow('[2]');
  });

  it('valid batch after a previously rejected one still works', async () => {
    const bad = makeDto(3);
    bad.payments[0].memo = '';
    await expect(service.createBatch('merchant-1', bad)).rejects.toThrow(BadRequestException);

    const good = makeDto(3);
    const result = await service.createBatch('merchant-1', good);
    expect(result.count).toBe(3);
  });

  // ── PaymentCreated events ─────────────────────────────────────────────────

  it('logs a PaymentCreated event for each item in the batch', async () => {
    const logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    await service.createBatch('merchant-1', makeDto(3));
    const paymentCreatedLogs = logSpy.mock.calls.filter(([msg]) =>
      String(msg).includes('PaymentCreated'),
    );
    expect(paymentCreatedLogs).toHaveLength(3);
  });
});
