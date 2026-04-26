import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Merchant, MerchantStatus } from '../merchants/entities/merchant.entity';
import { Payment, PaymentStatus, PaymentNetwork } from '../payments/entities/payment.entity';
import { Settlement, SettlementStatus } from '../settlements/entities/settlement.entity';

let counter = 0;
const next = () => ++counter;

// ─── Merchant ────────────────────────────────────────────────────────────────

export function merchantFactory(overrides: Partial<Merchant> = {}): Partial<Merchant> {
  const n = next();
  return {
    id: uuid(),
    email: `merchant${n}@test.com`,
    passwordHash: '$2b$12$hashedpassword',
    businessName: `Test Business ${n}`,
    businessType: 'retail',
    country: 'US',
    status: MerchantStatus.ACTIVE,
    feeRate: 0.015,
    totalVolumeUsd: 0,
    ...overrides,
  };
}

export async function createMerchant(
  dataSource: DataSource,
  overrides: Partial<Merchant> = {},
): Promise<Merchant> {
  const repo = dataSource.getRepository(Merchant);
  return repo.save(repo.create(merchantFactory(overrides) as Merchant));
}

// ─── Payment ─────────────────────────────────────────────────────────────────

export function paymentFactory(overrides: Partial<Payment> = {}): Partial<Payment> {
  const n = next();
  return {
    id: uuid(),
    reference: `PAY-${n}-${uuid().slice(0, 8).toUpperCase()}`,
    amountUsd: 100,
    network: PaymentNetwork.STELLAR,
    status: PaymentStatus.PENDING,
    stellarDepositAddress: 'GTEST1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    stellarMemo: `MEMO${n}`,
    currency: 'USD',
    ...overrides,
  };
}

export async function createPayment(
  dataSource: DataSource,
  merchantId: string,
  overrides: Partial<Payment> = {},
): Promise<Payment> {
  const repo = dataSource.getRepository(Payment);
  return repo.save(repo.create(paymentFactory({ merchantId, ...overrides }) as Payment));
}

// ─── Settlement ───────────────────────────────────────────────────────────────

export function settlementFactory(overrides: Partial<Settlement> = {}): Partial<Settlement> {
  return {
    id: uuid(),
    totalAmountUsd: 100,
    feeAmountUsd: 1.5,
    netAmountUsd: 98.5,
    fiatCurrency: 'USD',
    fiatAmount: 98.5,
    status: SettlementStatus.PENDING,
    ...overrides,
  };
}

export async function createSettlement(
  dataSource: DataSource,
  merchantId: string,
  overrides: Partial<Settlement> = {},
): Promise<Settlement> {
  const repo = dataSource.getRepository(Settlement);
  return repo.save(repo.create(settlementFactory({ merchantId, ...overrides }) as Settlement));
}
