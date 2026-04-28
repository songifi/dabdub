import { getQueueToken } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository, createConnection } from 'typeorm';
import { CacheService } from '../cache/cache.service';
import { Merchant, MerchantStatus } from '../merchants/entities/merchant.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { QUEUE_NAMES } from '../queues/queue.constants';
import { Settlement, SettlementStatus } from '../settlements/entities/settlement.entity';
import { SorobanEventIndexer } from './soroban-event-indexer.service';
import { OnEvent } from '@nestjs/event-emitter';
import {
  PaymentConfirmedEventDto,
  SettlementCompletedEventDto,
} from './soroban-event.dto';

class InMemoryCacheService {
  private readonly state = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.state.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.state.set(key, value);
  }
}

@Injectable()
class TestPaymentsListener {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepo: Repository<Payment>,
  ) {}

  @OnEvent('soroban.payment.confirmed')
  async handle(event: PaymentConfirmedEventDto): Promise<void> {
    const payment = await this.paymentsRepo.findOne({
      where: { reference: event.paymentReference },
    });
    if (!payment) return;
    payment.status = PaymentStatus.CONFIRMED;
    payment.txHash = event.txHash;
    payment.amountUsdc = event.amount;
    await this.paymentsRepo.save(payment);
  }
}

@Injectable()
class TestSettlementsListener {
  constructor(
    @InjectRepository(Settlement)
    private readonly settlementsRepo: Repository<Settlement>,
    @InjectRepository(Payment)
    private readonly paymentsRepo: Repository<Payment>,
  ) {}

  @OnEvent('soroban.settlement.completed')
  async handle(event: SettlementCompletedEventDto): Promise<void> {
    const settlement = await this.settlementsRepo.findOne({
      where: { id: event.settlementId },
    });
    if (!settlement) return;
    settlement.status = SettlementStatus.COMPLETED;
    settlement.partnerReference = event.partnerReference;
    await this.settlementsRepo.save(settlement);

    const payments = await this.paymentsRepo.find({
      where: { settlementId: settlement.id },
    });
    for (const payment of payments) {
      payment.status = PaymentStatus.SETTLED;
      await this.paymentsRepo.save(payment);
    }
  }
}

describe('SorobanEventIndexer (integration)', () => {
  let connection: Connection;
  let module: TestingModule;
  let indexer: SorobanEventIndexer;

  beforeAll(async () => {
    connection = await createConnection({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD ?? 'postgres',
      database: process.env.DB_NAME_TEST ?? 'cheesepay_test',
      entities: [Merchant, Payment, Settlement],
      synchronize: true,
      logging: false,
      name: 'soroban-indexer-integration',
    } as any);

    module = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USER ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres',
          database: process.env.DB_NAME_TEST ?? 'cheesepay_test',
          entities: [Merchant, Payment, Settlement],
          synchronize: true,
          logging: false,
          name: 'default',
        }),
        TypeOrmModule.forFeature([Payment, Settlement]),
      ],
      providers: [
        SorobanEventIndexer,
        TestPaymentsListener,
        TestSettlementsListener,
        { provide: CacheService, useClass: InMemoryCacheService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => {
              if (key === 'SOROBAN_RPC_URL') return 'http://soroban.test/rpc';
              if (key === 'SOROBAN_CONTRACT_ID') return 'CONTRACT-123';
              return fallback;
            },
          },
        },
        { provide: getQueueToken(QUEUE_NAMES.sorobanEventDlq), useValue: { add: jest.fn() } },
      ],
    }).compile();

    indexer = module.get(SorobanEventIndexer);
  });

  afterEach(async () => {
    await connection.query(
      'TRUNCATE TABLE "payments", "settlements", "merchants" RESTART IDENTITY CASCADE',
    );
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await module.close();
    if (connection.isConnected) await connection.close();
  });

  it('indexes a payment_confirmed contract event and updates payment status', async () => {
    const merchant = await connection.getRepository(Merchant).save(
      connection.getRepository(Merchant).create({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'merchant1@test.com',
        passwordHash: 'hash',
        businessName: 'Merchant 1',
        businessType: 'retail',
        country: 'US',
        status: MerchantStatus.ACTIVE,
        feeRate: 0.015,
      }),
    );
    const payment = (await connection.getRepository(Payment).save(
      connection.getRepository(Payment).create({
        id: '22222222-2222-4222-8222-222222222222',
        reference: 'PAY-REF-001',
        merchantId: merchant.id,
        amountUsd: 100,
        status: PaymentStatus.PENDING,
        network: 'stellar',
      } as any),
    )) as unknown as Payment;

    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          latestLedger: 1200,
          events: [
            {
              id: 'evt-1',
              pagingToken: 'pt-1',
              ledger: 1200,
              ledgerClosedAt: new Date().toISOString(),
              contractId: 'CONTRACT-123',
              topic: ['payment_confirmed'],
              value: {
                paymentReference: payment.reference,
                txHash: 'TX-123',
                amount: 100.5,
                asset: 'USDC',
                from: 'GABC',
              },
            },
          ],
        },
      }),
    } as Response);

    await indexer.pollEvents();

    const updated = await connection
      .getRepository(Payment)
      .findOneOrFail({ where: { id: payment.id } });

    expect(updated.status).toBe(PaymentStatus.CONFIRMED);
    expect(updated.txHash).toBe('TX-123');
    expect(Number(updated.amountUsdc)).toBe(100.5);
  });

  it('indexes a settlement_completed event and marks settlement/payments as settled', async () => {
    const merchant = await connection.getRepository(Merchant).save(
      connection.getRepository(Merchant).create({
        id: '33333333-3333-4333-8333-333333333333',
        email: 'merchant2@test.com',
        passwordHash: 'hash',
        businessName: 'Merchant 2',
        businessType: 'retail',
        country: 'US',
        status: MerchantStatus.ACTIVE,
        feeRate: 0.015,
      }),
    );
    const settlement = await connection.getRepository(Settlement).save(
      connection.getRepository(Settlement).create({
        merchantId: merchant.id,
        totalAmountUsd: 30,
        feeAmountUsd: 0.45,
        netAmountUsd: 29.55,
        fiatCurrency: 'USD',
        status: SettlementStatus.PROCESSING,
      }),
    );
    const payment = (await connection.getRepository(Payment).save(
      connection.getRepository(Payment).create({
        id: '44444444-4444-4444-8444-444444444444',
        reference: 'PAY-REF-002',
        merchantId: merchant.id,
        amountUsd: 30,
        status: PaymentStatus.SETTLING,
        network: 'stellar',
        settlementId: settlement.id,
      } as any),
    )) as unknown as Payment;

    jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          latestLedger: 1201,
          events: [
            {
              id: 'evt-2',
              pagingToken: 'pt-2',
              ledger: 1201,
              ledgerClosedAt: new Date().toISOString(),
              contractId: 'CONTRACT-123',
              topic: ['settlement_completed'],
              value: {
                settlementId: settlement.id,
                partnerReference: 'PARTNER-001',
              },
            },
          ],
        },
      }),
    } as Response);

    await indexer.pollEvents();

    const updatedSettlement = await connection
      .getRepository(Settlement)
      .findOneOrFail({ where: { id: settlement.id } });
    const updatedPayment = await connection
      .getRepository(Payment)
      .findOneOrFail({ where: { id: payment.id } });

    expect(updatedSettlement.status).toBe(SettlementStatus.COMPLETED);
    expect(updatedSettlement.partnerReference).toBe('PARTNER-001');
    expect(updatedPayment.status).toBe(PaymentStatus.SETTLED);
  });
});
