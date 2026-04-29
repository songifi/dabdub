import { Connection, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Merchant, MerchantRole, MerchantStatus } from '../../merchants/entities/merchant.entity';
import { Payment, PaymentNetwork, PaymentStatus } from '../../payments/entities/payment.entity';
import { Settlement, SettlementStatus } from '../../settlements/entities/settlement.entity';
import { seedAppConfigs } from './app-config.seed';

const DEFAULT_PASSWORD = 'Password123!';

const FIXED_IDS = {
  admin: '00000000-0000-0000-0000-000000000001',
  merchant1: '00000000-0000-0000-0000-000000000002',
  merchant2: '00000000-0000-0000-0000-000000000003',
  merchant3: '00000000-0000-0000-0000-000000000004',
  settlement1: '00000000-0000-0000-0000-000000000011',
  settlement2: '00000000-0000-0000-0000-000000000012',
  settlement3: '00000000-0000-0000-0000-000000000013',
  paymentPending: '00000000-0000-0000-0000-000000000021',
  paymentConfirmed: '00000000-0000-0000-0000-000000000022',
  paymentSettling: '00000000-0000-0000-0000-000000000023',
  paymentSettled: '00000000-0000-0000-0000-000000000024',
  paymentFailed: '00000000-0000-0000-0000-000000000025',
  paymentRefunded: '00000000-0000-0000-0000-000000000026',
};

export async function seedDatabase(connection: Connection, predictableIds = false): Promise<void> {
  await seedAppConfigs(connection as any);
  const merchants = await seedMerchants(connection, predictableIds);
  const settlements = await seedSettlements(connection, predictableIds, merchants);
  await seedPayments(connection, predictableIds, merchants, settlements);
  console.log('Database seeding complete.');
}

async function seedMerchants(connection: Connection, predictableIds: boolean) {
  const repo = connection.getRepository(Merchant);
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const seeds = [
    {
      id: predictableIds ? FIXED_IDS.admin : undefined,
      email: 'admin@localhost',
      businessName: 'Admin Merchant',
      businessType: 'Platform',
      country: 'US',
      status: MerchantStatus.ACTIVE,
      role: MerchantRole.ADMIN,
      passwordHash,
    },
    {
      id: predictableIds ? FIXED_IDS.merchant1 : undefined,
      email: 'merchant1@localhost',
      businessName: 'Northside Store',
      businessType: 'Retail',
      country: 'US',
      status: MerchantStatus.ACTIVE,
      role: MerchantRole.MERCHANT,
      passwordHash,
    },
    {
      id: predictableIds ? FIXED_IDS.merchant2 : undefined,
      email: 'merchant2@localhost',
      businessName: 'Marketplace Co',
      businessType: 'Ecommerce',
      country: 'GB',
      status: MerchantStatus.ACTIVE,
      role: MerchantRole.MERCHANT,
      passwordHash,
    },
    {
      id: predictableIds ? FIXED_IDS.merchant3 : undefined,
      email: 'merchant3@localhost',
      businessName: 'Global Retail',
      businessType: 'Finance',
      country: 'AU',
      status: MerchantStatus.ACTIVE,
      role: MerchantRole.MERCHANT,
      passwordHash,
    },
  ];

  const emails = seeds.map((seed) => seed.email);
  const existing = await repo.find({ where: { email: In(emails) } });
  const existingByEmail = new Map(existing.map((merchant) => [merchant.email, merchant]));

  const saved = [];
  for (const seed of seeds) {
    const current = existingByEmail.get(seed.email);
    if (current) {
      const merged = repo.merge(current, seed);
      merged.id = current.id;
      saved.push(await repo.save(merged));
    } else {
      saved.push(await repo.save(repo.create(seed)));
    }
  }

  console.log('Merchants seeded.');
  return saved;
}

async function seedSettlements(connection: Connection, predictableIds: boolean, merchants: Merchant[]) {
  const repo = connection.getRepository(Settlement);
  const merchantMap = new Map(merchants.map((merchant) => [merchant.email, merchant]));

  const seeds = [
    {
      id: predictableIds ? FIXED_IDS.settlement1 : undefined,
      merchantId: merchantMap.get('merchant2@localhost')?.id,
      totalAmountUsd: 500,
      feeAmountUsd: 7.5,
      netAmountUsd: 492.5,
      fiatCurrency: 'USD',
      fiatAmount: 500,
      status: SettlementStatus.COMPLETED,
      partnerReference: 'SETTLEMENT-COMPLETE-1',
      bankReference: 'BANK-001',
      completedAt: new Date(),
    },
    {
      id: predictableIds ? FIXED_IDS.settlement2 : undefined,
      merchantId: merchantMap.get('merchant3@localhost')?.id,
      totalAmountUsd: 300,
      feeAmountUsd: 4.5,
      netAmountUsd: 295.5,
      fiatCurrency: 'USD',
      fiatAmount: 300,
      status: SettlementStatus.FAILED,
      partnerReference: 'SETTLEMENT-FAILED-1',
      bankReference: 'BANK-002',
      failureReason: 'Partner rejection',
    },
    {
      id: predictableIds ? FIXED_IDS.settlement3 : undefined,
      merchantId: merchantMap.get('merchant1@localhost')?.id,
      totalAmountUsd: 180,
      feeAmountUsd: 2.7,
      netAmountUsd: 177.3,
      fiatCurrency: 'USD',
      fiatAmount: 180,
      status: SettlementStatus.PENDING_APPROVAL,
      partnerReference: 'SETTLEMENT-PENDING-1',
      bankReference: 'BANK-003',
    },
  ];

  const partnerReferences = seeds.map((seed) => seed.partnerReference);
  const existing = await repo.find({ where: { partnerReference: In(partnerReferences) } });
  const existingByPartnerReference = new Map(existing.map((settlement) => [settlement.partnerReference, settlement]));

  const saved = [];
  for (const seed of seeds) {
    const current = existingByPartnerReference.get(seed.partnerReference);
    if (current) {
      const merged = repo.merge(current, seed);
      merged.id = current.id;
      saved.push(await repo.save(merged));
    } else {
      saved.push(await repo.save(repo.create(seed)));
    }
  }

  console.log('Settlements seeded.');
  return saved;
}

async function seedPayments(
  connection: Connection,
  predictableIds: boolean,
  merchants: Merchant[],
  settlements: Settlement[],
) {
  const repo = connection.getRepository(Payment);
  const merchantMap = new Map(merchants.map((merchant) => [merchant.email, merchant]));
  const settlementMap = new Map(settlements.map((settlement) => [settlement.partnerReference, settlement]));

  const seeds = [
    {
      id: predictableIds ? FIXED_IDS.paymentPending : undefined,
      reference: 'PAYMENT-PENDING-1',
      merchantId: merchantMap.get('merchant1@localhost')?.id,
      amountUsd: 52.5,
      network: PaymentNetwork.STELLAR,
      status: PaymentStatus.PENDING,
      description: 'Pending payment demo',
      customerEmail: 'customer1@example.com',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      metadata: { source: 'seed' },
    },
    {
      id: predictableIds ? FIXED_IDS.paymentConfirmed : undefined,
      reference: 'PAYMENT-CONFIRMED-1',
      merchantId: merchantMap.get('merchant1@localhost')?.id,
      amountUsd: 120.0,
      network: PaymentNetwork.POLYGON,
      status: PaymentStatus.CONFIRMED,
      description: 'Confirmed payment demo',
      customerEmail: 'customer2@example.com',
      metadata: { source: 'seed' },
      confirmedAt: new Date(),
    },
    {
      id: predictableIds ? FIXED_IDS.paymentSettling : undefined,
      reference: 'PAYMENT-SETTLING-1',
      merchantId: merchantMap.get('merchant2@localhost')?.id,
      amountUsd: 225.0,
      network: PaymentNetwork.BASE,
      status: PaymentStatus.SETTLING,
      description: 'Settling payment demo',
      customerEmail: 'customer3@example.com',
      metadata: { source: 'seed' },
    },
    {
      id: predictableIds ? FIXED_IDS.paymentSettled : undefined,
      reference: 'PAYMENT-SETTLED-1',
      merchantId: merchantMap.get('merchant2@localhost')?.id,
      amountUsd: 500.0,
      network: PaymentNetwork.CELO,
      status: PaymentStatus.SETTLED,
      description: 'Settled payment demo',
      customerEmail: 'customer4@example.com',
      metadata: { source: 'seed' },
      confirmedAt: new Date(),
      settlementId: settlementMap.get('SETTLEMENT-COMPLETE-1')?.id,
      settlementAmountFiat: 500,
      settlementCurrency: 'USD',
    },
    {
      id: predictableIds ? FIXED_IDS.paymentFailed : undefined,
      reference: 'PAYMENT-FAILED-1',
      merchantId: merchantMap.get('merchant3@localhost')?.id,
      amountUsd: 99.99,
      network: PaymentNetwork.ARBITRUM,
      status: PaymentStatus.FAILED,
      description: 'Failed payment demo',
      customerEmail: 'customer5@example.com',
      metadata: { source: 'seed' },
    },
    {
      id: predictableIds ? FIXED_IDS.paymentRefunded : undefined,
      reference: 'PAYMENT-REFUNDED-1',
      merchantId: merchantMap.get('merchant3@localhost')?.id,
      amountUsd: 25.0,
      network: PaymentNetwork.OPTIMISM,
      status: PaymentStatus.REFUNDED,
      description: 'Refunded payment demo',
      customerEmail: 'customer6@example.com',
      metadata: { source: 'seed' },
      refundAmountUsd: 25.0,
      refundedAt: new Date(),
    },
  ];

  const references = seeds.map((seed) => seed.reference);
  const existing = await repo.find({ where: { reference: In(references) } });
  const existingByReference = new Map(existing.map((payment) => [payment.reference, payment]));

  for (const seed of seeds) {
    const current = existingByReference.get(seed.reference);
    if (current) {
      const merged = repo.merge(current, seed);
      merged.id = current.id;
      await repo.save(merged);
    } else {
      await repo.save(repo.create(seed));
    }
  }

  console.log('Payments seeded.');
}
