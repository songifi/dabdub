import { DataSource } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { PaymentsService } from '../payments/payments.service';
import { Payment } from '../payments/entities/payment.entity';
import { StellarService } from '../stellar/stellar.service';
import { createMockStellarService } from '../stellar/stellar.service.mock';
import { createTestDataSource, truncateAll, closeTestDataSource, TEST_ENTITIES } from './db';
import { createMerchant } from './factories';

describe('PaymentsService (integration)', () => {
  let dataSource: DataSource;
  let module: TestingModule;
  let service: PaymentsService;

  beforeAll(async () => {
    dataSource = await createTestDataSource();

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USER ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres',
          database: process.env.DB_NAME_TEST ?? 'cheesepay_test',
          entities: TEST_ENTITIES,
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([Payment]),
      ],
      providers: [
        PaymentsService,
        { provide: StellarService, useValue: createMockStellarService() },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  afterEach(async () => {
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await module.close();
    await closeTestDataSource(dataSource);
  });

  it('creates a payment and persists it', async () => {
    const merchant = await createMerchant(dataSource);

    const payment = await service.create(merchant.id, {
      amountUsd: 50,
      description: 'Test payment',
    });

    expect(payment.id).toBeDefined();
    expect(payment.merchantId).toBe(merchant.id);
    expect(payment.amountUsd).toBe(50);
    expect(payment.stellarMemo).toBe('TESTMEMO');
  });

  it('lists payments for a merchant', async () => {
    const merchant = await createMerchant(dataSource);
    await service.create(merchant.id, { amountUsd: 10 });
    await service.create(merchant.id, { amountUsd: 20 });

    const result = await service.findAll(merchant.id);
    expect(result.total).toBe(2);
    expect(result.payments).toHaveLength(2);
  });

  it('does not return payments from another merchant', async () => {
    const m1 = await createMerchant(dataSource);
    const m2 = await createMerchant(dataSource);
    await service.create(m1.id, { amountUsd: 10 });

    const result = await service.findAll(m2.id);
    expect(result.total).toBe(0);
  });
});
