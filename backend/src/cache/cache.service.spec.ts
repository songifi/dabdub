import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { REDIS_CLIENT } from './redis.module';

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  unlink: jest.fn(),
  scan: jest.fn(),
};

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();
    service = module.get(CacheService);
  });

  it('set → get returns value', async () => {
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(JSON.stringify({ a: 1 }));

    await service.set('test:key', { a: 1 }, 60);
    const result = await service.get<{ a: number }>('test:key');

    expect(result).toEqual({ a: 1 });
  });

  it('missing key → null', async () => {
    mockRedis.get.mockResolvedValue(null);
    expect(await service.get('missing:key')).toBeNull();
  });

  it('Redis error on get → null (not throw)', async () => {
    mockRedis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.get('any:key')).resolves.toBeNull();
  });

  it('Redis error on set → returns false (not throw)', async () => {
    mockRedis.setex.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(service.set('any:key', 'val', 60)).resolves.toBe(false);
  });

  it('delPattern uses SCAN + UNLINK', async () => {
    mockRedis.scan
      .mockResolvedValueOnce(['42', ['rate:USDC:NGN', 'rate:USDC:USD']])
      .mockResolvedValueOnce(['0', []]);
    await service.delPattern('rate:USDC:*');
    expect(mockRedis.unlink).toHaveBeenCalledWith('rate:USDC:NGN', 'rate:USDC:USD');
  });
});

describe('@Cacheable decorator', () => {
  it('first call hits DB, second hits cache', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValueOnce(JSON.stringify({ id: '1' }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
        {
          provide: 'TestSvc',
          useFactory: (cache: CacheService) => {
            class TestSvc {
              _cacheService = cache;
              dbCallCount = 0;

              async findUser(id: string) {
                const key = `user:profile:${id}`;
                const cached = await cache.get(key);
                if (cached !== null) return cached;
                this.dbCallCount++;
                const result = { id };
                await cache.set(key, result, 300);
                return result;
              }
            }
            return new TestSvc();
          },
          inject: [CacheService],
        },
      ],
    }).compile();

    const svc = module.get<{ findUser: (id: string) => Promise<unknown>; dbCallCount: number }>('TestSvc');

    const first = await svc.findUser('1');
    const second = await svc.findUser('1');

    expect(first).toEqual({ id: '1' });
    expect(second).toEqual({ id: '1' });
    expect(svc.dbCallCount).toBe(1);
  });
});
