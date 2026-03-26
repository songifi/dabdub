import { ServiceUnavailableException } from '@nestjs/common';
import { MaintenanceModeMiddleware } from './maintenance-mode.middleware';
import { CacheService } from '../../cache/cache.service';

const mockCache = { get: jest.fn() } as unknown as CacheService;

const makeReq = (path: string) => ({ path } as any);
const res = {} as any;
const next = jest.fn();

describe('MaintenanceModeMiddleware', () => {
  let middleware: MaintenanceModeMiddleware;

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = new MaintenanceModeMiddleware(mockCache);
  });

  it('passes through /admin routes regardless of maintenance flag', async () => {
    (mockCache.get as jest.Mock).mockResolvedValue(true);

    await middleware.use(makeReq('/admin/config'), res, next);

    expect(next).toHaveBeenCalled();
    expect(mockCache.get).not.toHaveBeenCalled();
  });

  it('passes through /health route regardless of maintenance flag', async () => {
    (mockCache.get as jest.Mock).mockResolvedValue(true);

    await middleware.use(makeReq('/health'), res, next);

    expect(next).toHaveBeenCalled();
    expect(mockCache.get).not.toHaveBeenCalled();
  });

  it('throws 503 when maintenance_mode=true for non-admin route', async () => {
    (mockCache.get as jest.Mock).mockResolvedValue(true);

    await expect(
      middleware.use(makeReq('/api/wallets'), res, next),
    ).rejects.toThrow(ServiceUnavailableException);

    expect(next).not.toHaveBeenCalled();
  });

  it('passes through when maintenance_mode=false', async () => {
    (mockCache.get as jest.Mock).mockResolvedValue(false);

    await middleware.use(makeReq('/api/wallets'), res, next);

    expect(next).toHaveBeenCalled();
  });

  it('passes through when maintenance_mode is null (cache miss)', async () => {
    (mockCache.get as jest.Mock).mockResolvedValue(null);

    await middleware.use(makeReq('/api/wallets'), res, next);

    expect(next).toHaveBeenCalled();
  });

  it('reads from Redis only — no DB call', async () => {
    (mockCache.get as jest.Mock).mockResolvedValue(false);

    await middleware.use(makeReq('/api/payments'), res, next);

    expect(mockCache.get).toHaveBeenCalledWith('config:maintenance_mode');
    expect(mockCache.get).toHaveBeenCalledTimes(1);
  });
});
