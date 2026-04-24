import { ConfigService } from '@nestjs/config';
import { AnalyticsCacheService } from './analytics-cache.service';

function mockConfig(overrides: Partial<Record<string, unknown>> = {}): ConfigService {
  return {
    get: (key: string, def?: unknown) =>
      (overrides[key] !== undefined ? overrides[key] : def) as ReturnType<ConfigService['get']>,
  } as ConfigService;
}

describe('AnalyticsCacheService', () => {
  it('buildKey follows analytics:{merchantId}:{endpoint}:{dateRange}', () => {
    const svc = new AnalyticsCacheService(mockConfig());
    expect(svc.buildKey('m1', 'volume', 'daily')).toBe('analytics:m1:volume:daily');
  });

  it('compresses and decompresses large payloads (gzip)', async () => {
    const svc = new AnalyticsCacheService(
      mockConfig({ ANALYTICS_CACHE_MIN_COMPRESS_BYTES: 16 }),
    );
    const big = { x: 'y'.repeat(100) };
    await svc.setParsed('m', 'volume', 'daily', 'merchant', big);
    const got = await svc.getParsed<typeof big>('m', 'volume', 'daily', 'merchant');
    expect(got).toEqual(big);
  });

  it('invalidateAfterPaymentSettled clears merchant and admin keys (memory)', async () => {
    const svc = new AnalyticsCacheService(mockConfig());
    await svc.setParsed('m1', 'volume', 'daily', 'merchant', { a: 1 });
    await svc.setParsed('admin', 'merchants', '2026-01-01', 'admin', { b: 2 });
    await svc.invalidateAfterPaymentSettled('m1');
    expect(await svc.getParsed('m1', 'volume', 'daily', 'merchant')).toBeNull();
    expect(await svc.getParsed('admin', 'merchants', '2026-01-01', 'admin')).toBeNull();
  });
});
