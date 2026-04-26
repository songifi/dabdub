import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettlementProcessor } from './settlement.processor';
import { Settlement, SettlementStatus } from '../entities/settlement.entity';
import { REDIS_CLIENT } from '../../cache/redis.module';
import { QueueRegistryService } from '../../queue/queue.registry';

describe('SettlementProcessor', () => {
  let processor: SettlementProcessor;
  let settlementRepo: any;
  let redis: any;
  let queueRegistry: any;

  beforeEach(async () => {
    settlementRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    redis = {
      set: jest.fn(),
      del: jest.fn(),
    };

    queueRegistry = {
      registerHandler: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementProcessor,
        {
          provide: getRepositoryToken(Settlement),
          useValue: settlementRepo,
        },
        {
          provide: REDIS_CLIENT,
          useValue: redis,
        },
        {
          provide: QueueRegistryService,
          useValue: queueRegistry,
        },
      ],
    }).compile();

    processor = module.get<SettlementProcessor>(SettlementProcessor);
  });

  it('should process a settlement successfully when lock is acquired', async () => {
    const job = {
      data: { settlementId: 's1', merchantId: 'm1' },
      opts: { attempts: 3 },
      attemptsMade: 0,
    } as any;

    redis.set.mockResolvedValue('OK');
    settlementRepo.findOne.mockResolvedValue({
      id: 's1',
      status: SettlementStatus.QUEUED,
    });
    settlementRepo.save.mockImplementation((s: any) => Promise.resolve(s));

    const result = await processor.handle(job);

    expect(result).toEqual({ success: true, settlementId: 's1' });
    expect(redis.del).toHaveBeenCalledWith('lock:settlement:merchant:m1');
  });

  it('should throw error when lock is active', async () => {
    const job = {
      data: { settlementId: 's2', merchantId: 'm1' },
    } as any;

    redis.set.mockResolvedValue(null);

    await expect(processor.handle(job)).rejects.toThrow(
      'Merchant m1 is already processing a settlement',
    );
  });
});
