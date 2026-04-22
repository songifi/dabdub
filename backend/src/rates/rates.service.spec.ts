import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RatesService, StaleRateException } from './rates.service';
import { RateSnapshot } from './entities/rate-snapshot.entity';
import { CacheService } from '../cache/cache.service';

const mockCache = { get: jest.fn(), set: jest.fn() };
const mockRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn() };

const freshSnapshot: Partial<RateSnapshot> = {
  rate: '1580.00',
  source: 'bybit_p2p',
  fetchedAt: new Date(),
};

const staleSnapshot: Partial<RateSnapshot> = {
  rate: '1500.00',
  source: 'bybit_p2p',
  fetchedAt: new Date(Date.now() - 6 * 60 * 1000), // 6 min ago
};

describe('RatesService.getRate', () => {
  let service: RatesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatesService,
        { provide: getRepositoryToken(RateSnapshot), useValue: mockRepo },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();
    service = module.get(RatesService);
  });

  it('cache hit → returns Redis value without hitting DB', async () => {
    mockCache.get.mockResolvedValue({ rate: '1580.00', fetchedAt: new Date().toISOString(), source: 'bybit_p2p' });

    const result = await service.getRate('USDC', 'NGN');

    expect(result.rate).toBe('1580.00');
    expect(result.isStale).toBe(false);
    expect(mockRepo.findOne).not.toHaveBeenCalled();
  });

  it('cache miss → falls back to DB snapshot', async () => {
    mockCache.get.mockResolvedValue(null);
    mockRepo.findOne.mockResolvedValue(freshSnapshot);

    const result = await service.getRate('USDC', 'NGN');

    expect(result.rate).toBe('1580.00');
    expect(result.isStale).toBe(true);
    expect(mockRepo.findOne).toHaveBeenCalled();
  });

  it('cache miss + snapshot older than 5min → throws StaleRateException', async () => {
    mockCache.get.mockResolvedValue(null);
    mockRepo.findOne.mockResolvedValue(staleSnapshot);

    await expect(service.getRate('USDC', 'NGN')).rejects.toBeInstanceOf(StaleRateException);
  });

  it('cache miss + no snapshot → throws StaleRateException', async () => {
    mockCache.get.mockResolvedValue(null);
    mockRepo.findOne.mockResolvedValue(null);

    await expect(service.getRate('USDC', 'NGN')).rejects.toBeInstanceOf(StaleRateException);
  });
});
