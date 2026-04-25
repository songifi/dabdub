import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnalyticsQueryCacheService } from './analytics-query-cache.service';

describe('AnalyticsQueryCacheService', () => {
  let service: AnalyticsQueryCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsQueryCacheService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get(AnalyticsQueryCacheService);
    service.clearAllForTests();
  });

  it('should round-trip small payloads through memory cache', async () => {
    const key = service.buildKey('m1', 'volume', 'daily|2026-01-01|2026-01-02');
    expect(await service.get(key)).toBeNull();
    await service.set(key, { a: 1 }, 'merchant');
    expect(await service.get<{ a: number }>(key)).toEqual({ a: 1 });
  });

  it('should compress and decode large JSON payloads', async () => {
    const key = service.buildKey('m1', 'networks', 'x');
    const large = { items: 'x'.repeat(5000) };
    await service.set(key, large, 'merchant');
    const got = await service.get<{ items: string }>(key);
    expect(got?.items.length).toBe(5000);
  });

  it('should use longer TTL constant for admin audience', () => {
    expect(service.audienceTtlSeconds('merchant')).toBe(300);
    expect(service.audienceTtlSeconds('admin')).toBe(600);
  });

  it('should invalidate merchant and all segments', async () => {
    await service.set(service.buildKey('mid', 'revenue', 'r1'), { v: 1 }, 'merchant');
    await service.set(service.buildKey('all', 'revenue', 'r1'), { v: 2 }, 'admin');
    await service.set(service.buildKey('other', 'revenue', 'r1'), { v: 3 }, 'merchant');

    await service.invalidateAfterPaymentSettled('mid');

    expect(await service.get(service.buildKey('mid', 'revenue', 'r1'))).toBeNull();
    expect(await service.get(service.buildKey('all', 'revenue', 'r1'))).toBeNull();
    expect(await service.get(service.buildKey('other', 'revenue', 'r1'))).toEqual({ v: 3 });
  });
});
