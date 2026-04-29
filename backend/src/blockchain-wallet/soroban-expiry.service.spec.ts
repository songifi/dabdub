import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  SorobanService,
  PaymentExpiredError,
} from './soroban.service';

describe('SorobanService — ledger-based payment expiry', () => {
  let service: SorobanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get(SorobanService);
    // Start every test at a known ledger
    service.setCurrentLedger(1000);
  });

  // ── createPayment ─────────────────────────────────────────────────────────

  it('stores expiry_ledger = current_ledger + expiryLedgers', () => {
    const p = service.createPayment('pay-1', 'GMERCHANT', '100', 360);
    expect(p.expiryLedger).toBe(1360); // 1000 + 360
  });

  it('uses DEFAULT_EXPIRY_LEDGERS (360) when not specified', () => {
    const p = service.createPayment('pay-2', 'GMERCHANT', '50');
    expect(p.expiryLedger).toBe(1000 + SorobanService.DEFAULT_EXPIRY_LEDGERS);
  });

  it('payment starts as pending', () => {
    const p = service.createPayment('pay-3', 'GMERCHANT', '25');
    expect(p.status).toBe('pending');
  });

  // ── confirm() — expiry boundary conditions ────────────────────────────────

  it('confirm() succeeds when current_ledger < expiry_ledger', async () => {
    service.createPayment('pay-4', 'GMERCHANT', '100', 360);
    service.setCurrentLedger(1359); // one ledger before expiry
    await expect(service.confirm('pay-4', 'GCUSTOMER')).resolves.toBeUndefined();
    expect(service.getPayment('pay-4')!.status).toBe('confirmed');
  });

  it('confirm() succeeds exactly AT expiry_ledger (boundary — not yet expired)', async () => {
    service.createPayment('pay-5', 'GMERCHANT', '100', 360);
    service.setCurrentLedger(1360); // exactly at expiry_ledger
    // Contract rule: expired when current > expiry_ledger, so AT is still valid
    await expect(service.confirm('pay-5', 'GCUSTOMER')).resolves.toBeUndefined();
  });

  it('confirm() throws PaymentExpiredError when current_ledger > expiry_ledger', async () => {
    service.createPayment('pay-6', 'GMERCHANT', '100', 360);
    service.setCurrentLedger(1361); // one ledger past expiry
    await expect(service.confirm('pay-6', 'GCUSTOMER')).rejects.toThrow(PaymentExpiredError);
  });

  it('PaymentExpiredError carries paymentId, expiryLedger, currentLedger', async () => {
    service.createPayment('pay-7', 'GMERCHANT', '100', 360);
    service.setCurrentLedger(2000);

    let err: PaymentExpiredError | null = null;
    try {
      await service.confirm('pay-7', 'GCUSTOMER');
    } catch (e) {
      err = e as PaymentExpiredError;
    }

    expect(err).toBeInstanceOf(PaymentExpiredError);
    expect(err!.paymentId).toBe('pay-7');
    expect(err!.expiryLedger).toBe(1360);
    expect(err!.currentLedger).toBe(2000);
  });

  it('confirm() does not mutate state when it throws PaymentExpiredError', async () => {
    service.createPayment('pay-8', 'GMERCHANT', '100', 360);
    service.setCurrentLedger(1500);

    await expect(service.confirm('pay-8', 'GCUSTOMER')).rejects.toThrow(PaymentExpiredError);
    // Status must remain pending — no partial state change
    expect(service.getPayment('pay-8')!.status).toBe('pending');
  });

  // ── expirePayment() ───────────────────────────────────────────────────────

  it('expirePayment() returns null when payment is not yet expired', async () => {
    service.createPayment('pay-9', 'GMERCHANT', '100', 360);
    service.setCurrentLedger(1360); // at boundary — not yet expired
    const event = await service.expirePayment('pay-9');
    expect(event).toBeNull();
    expect(service.getPayment('pay-9')!.status).toBe('pending');
  });

  it('expirePayment() marks payment expired and emits PaymentExpired event', async () => {
    service.createPayment('pay-10', 'GMERCHANT', '100', 360);
    service.setCurrentLedger(1361);

    const event = await service.expirePayment('pay-10');

    expect(event).not.toBeNull();
    expect(event!.type).toBe('PaymentExpired');
    expect(event!.paymentId).toBe('pay-10');
    expect(event!.expiryLedger).toBe(1360);
    expect(event!.ledgerAtExpiry).toBe(1361);
    expect(service.getPayment('pay-10')!.status).toBe('expired');
  });

  it('PaymentExpired event includes refund instructions', async () => {
    service.createPayment('pay-11', 'GMERCHANT', '75.5', 360);
    service.setCurrentLedger(1500);

    const event = await service.expirePayment('pay-11');

    expect(event!.refundInstruction.amountUsdc).toBe('75.5');
    expect(event!.refundInstruction.returnToAddress).toBeNull(); // no customer yet
  });

  it('expirePayment() is idempotent — second call returns null', async () => {
    service.createPayment('pay-12', 'GMERCHANT', '100', 360);
    service.setCurrentLedger(1500);

    await service.expirePayment('pay-12');
    const second = await service.expirePayment('pay-12');

    expect(second).toBeNull();
    expect(service.getExpiredEventLog()).toHaveLength(1);
  });

  it('expirePayment() does nothing on a confirmed payment', async () => {
    service.createPayment('pay-13', 'GMERCHANT', '100', 360);
    service.setCurrentLedger(1000); // still valid
    await service.confirm('pay-13', 'GCUSTOMER');

    service.setCurrentLedger(2000); // advance past expiry
    const event = await service.expirePayment('pay-13');

    expect(event).toBeNull();
    expect(service.getPayment('pay-13')!.status).toBe('confirmed');
  });

  // ── isExpired() view ──────────────────────────────────────────────────────

  it('isExpired() returns false before expiry_ledger', () => {
    service.createPayment('pay-14', 'GMERCHANT', '100', 360);
    service.setCurrentLedger(1360);
    expect(service.isExpired('pay-14')).toBe(false);
  });

  it('isExpired() returns true after expiry_ledger', () => {
    service.createPayment('pay-15', 'GMERCHANT', '100', 360);
    service.setCurrentLedger(1361);
    expect(service.isExpired('pay-15')).toBe(true);
  });

  // ── Ledger advancement simulation ─────────────────────────────────────────

  it('advanceLedger() simulates time passing deterministically', async () => {
    service.createPayment('pay-16', 'GMERCHANT', '100', 10);
    // expiry_ledger = 1010

    service.advanceLedger(9);  // ledger 1009 — still valid
    await expect(service.confirm('pay-16', 'GCUSTOMER')).resolves.toBeUndefined();

    service.createPayment('pay-17', 'GMERCHANT', '100', 10);
    // expiry_ledger = 1019

    service.advanceLedger(11); // ledger 1020 — expired
    await expect(service.confirm('pay-17', 'GCUSTOMER')).rejects.toThrow(PaymentExpiredError);
  });

  // ── LEDGERS_PER_MINUTE constant ───────────────────────────────────────────

  it('LEDGERS_PER_MINUTE is 12 (1 ledger per 5 seconds)', () => {
    expect(SorobanService.LEDGERS_PER_MINUTE).toBe(12);
  });

  it('30 minutes = 360 ledgers at LEDGERS_PER_MINUTE rate', () => {
    expect(30 * SorobanService.LEDGERS_PER_MINUTE).toBe(SorobanService.DEFAULT_EXPIRY_LEDGERS);
  });
});
