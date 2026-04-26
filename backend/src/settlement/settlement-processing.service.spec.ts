import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettlementProcessingService } from './settlement-processing.service';
import { Settlement } from './entities/settlement.entity';
import { Merchant } from '../merchants/entities/merchant.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';
import { QueueRegistryService } from '../queue/queue.registry';
import { RatesService } from '../rates/rates.service';

describe('SettlementProcessingService', () => {
  let service: SettlementProcessingService;
  let settlementRepo: any;
  let merchantRepo: any;
  let bankAccountRepo: any;
  let queueRegistry: any;
  let ratesService: any;

  beforeEach(async () => {
    settlementRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation((s) => Promise.resolve({ ...s, id: 's1' })),
    };

    merchantRepo = {
      findOne: jest.fn(),
    };

    bankAccountRepo = {
      findOne: jest.fn(),
    };

    queueRegistry = {
      add: jest.fn().mockResolvedValue({ id: 'j1' }),
    };

    ratesService = {
      getRate: jest.fn().mockResolvedValue({ rate: '1500.50' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementProcessingService,
        {
          provide: getRepositoryToken(Settlement),
          useValue: settlementRepo,
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: merchantRepo,
        },
        {
          provide: getRepositoryToken(BankAccount),
          useValue: bankAccountRepo,
        },
        {
          provide: QueueRegistryService,
          useValue: queueRegistry,
        },
        {
          provide: RatesService,
          useValue: ratesService,
        },
      ],
    }).compile();

    service = module.get<SettlementProcessingService>(SettlementProcessingService);
  });

  it('should enqueue a settlement job correctly', async () => {
    merchantRepo.findOne.mockResolvedValue({
      userId: 'm1',
      id: 'merchant-1',
      autoSettleEnabled: true,
      settlementThresholdUsdc: 10,
    });

    bankAccountRepo.findOne.mockResolvedValue({
      id: 'ba1',
      userId: 'm1',
      isDefault: true,
    });

    await service.enqueueSettlement('m1', 100, 'token1');

    expect(settlementRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'm1',
      usdcAmount: 100,
      bankAccountId: 'ba1',
    }));

    expect(queueRegistry.add).toHaveBeenCalledWith(
      'settlement-jobs',
      'process-settlement',
      expect.objectContaining({ settlementId: 's1', merchantId: 'm1' }),
      expect.any(Object)
    );
  });
});
