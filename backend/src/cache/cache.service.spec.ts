import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    service = new CacheService();
  });

  it('should store small payloads without compression envelope', () => {
    const raw = (service as any).encode({ ok: true });
    const envelope = JSON.parse(raw);
    expect(envelope.encoding).toBe('json');
  });

  it('should use lz4 compression for large payloads and decode them', () => {
    const payload = { data: 'x'.repeat(10_000), count: 42 };
    const raw = (service as any).encode(payload);
    const envelope = JSON.parse(raw);

    expect(envelope.encoding).toBe('lz4+base64');

    const decoded = (service as any).decode(raw);
    expect(decoded).toEqual(payload);
  });
});
