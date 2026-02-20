import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { AdminThrottlerGuard } from './admin-throttler.guard';
import { THROTTLE_BY_API_KEY } from '../decorators/throttle-by-api-key.decorator';

const buildStorageRecord = (overrides: Partial<{
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}> = {}) => ({
  totalHits: 1,
  timeToExpire: 60,
  isBlocked: false,
  timeToBlockExpire: 0,
  ...overrides,
});

const buildThrottlerOptions = (): ThrottlerModuleOptions => ({
  throttlers: [
    { name: 'global', ttl: 60_000, limit: 100 },
    { name: 'auth', ttl: 60_000, limit: 10 },
    { name: 'sensitive', ttl: 60_000, limit: 5 },
  ],
});

const buildContext = (overrides: {
  ip?: string;
  headers?: Record<string, string>;
  setHeader?: jest.Mock;
} = {}): ExecutionContext => {
  const req = {
    ip: overrides.ip ?? '192.168.1.1',
    ips: [],
    headers: overrides.headers ?? {},
    requestId: 'test-request-id',
    _throttleByApiKey: false,
  };

  const res = {
    header: overrides.setHeader ?? jest.fn(),
  };

  return {
    getHandler: jest.fn().mockReturnValue({}),
    getClass: jest.fn().mockReturnValue({}),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(req),
      getResponse: jest.fn().mockReturnValue(res),
    }),
  } as unknown as ExecutionContext;
};

describe('AdminThrottlerGuard', () => {
  let guard: AdminThrottlerGuard;
  let storageService: jest.Mocked<ThrottlerStorage>;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    storageService = {
      increment: jest.fn().mockResolvedValue(buildStorageRecord()),
    };

    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<Reflector>;

    guard = new AdminThrottlerGuard(
      buildThrottlerOptions(),
      storageService,
      reflector,
    );

    // Initialize the guard (normally called by NestJS lifecycle)
    return guard.onModuleInit();
  });

  afterEach(() => {
    delete process.env.THROTTLE_WHITELIST_IPS;
  });

  describe('getTracker', () => {
    it('uses X-Forwarded-For when present', async () => {
      const context = buildContext({
        headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
      });
      const req = context.switchToHttp().getRequest();

      // Access protected method via type cast
      const tracker = await (guard as any).getTracker(req);

      expect(tracker).toBe('203.0.113.5');
    });

    it('falls back to req.ip when no X-Forwarded-For header', async () => {
      const context = buildContext({ ip: '10.10.10.10' });
      const req = context.switchToHttp().getRequest();

      const tracker = await (guard as any).getTracker(req);

      expect(tracker).toBe('10.10.10.10');
    });

    it('uses API key as tracker when @ThrottleByApiKey() is applied', async () => {
      const context = buildContext({
        headers: { 'x-api-key': 'test-key-abc123' },
      });
      const req = context.switchToHttp().getRequest();
      req._throttleByApiKey = true;

      const tracker = await (guard as any).getTracker(req);

      expect(tracker).toBe('api-key:test-key-abc123');
    });

    it('falls back to IP when @ThrottleByApiKey() is set but no key in header', async () => {
      const context = buildContext({ ip: '10.0.0.5' });
      const req = context.switchToHttp().getRequest();
      req._throttleByApiKey = true;

      const tracker = await (guard as any).getTracker(req);

      expect(tracker).toBe('10.0.0.5');
    });
  });

  describe('shouldSkip (IP whitelist)', () => {
    it('skips whitelisted IPs from env var', async () => {
      process.env.THROTTLE_WHITELIST_IPS = '10.0.0.1,10.0.0.2';
      const context = buildContext({ ip: '10.0.0.1' });

      const result = await (guard as any).shouldSkip(context);

      expect(result).toBe(true);
    });

    it('does not skip non-whitelisted IPs', async () => {
      process.env.THROTTLE_WHITELIST_IPS = '10.0.0.1';
      const context = buildContext({ ip: '192.168.1.100' });

      const result = await (guard as any).shouldSkip(context);

      expect(result).toBe(false);
    });

    it('allows loopback IPs by default', async () => {
      delete process.env.THROTTLE_WHITELIST_IPS;
      const context = buildContext({ ip: '127.0.0.1' });

      const result = await (guard as any).shouldSkip(context);

      expect(result).toBe(true);
    });
  });

  describe('throwThrottlingException', () => {
    it('throws HttpException with status 429', async () => {
      const setHeader = jest.fn();
      const context = buildContext({ setHeader });
      const limitDetail = {
        totalHits: 11,
        timeToExpire: 42,
        isBlocked: true,
        timeToBlockExpire: 42,
        limit: 10,
        ttl: 60_000,
        key: 'test-key',
        tracker: '192.168.1.1',
      };

      await expect(
        (guard as any).throwThrottlingException(context, limitDetail),
      ).rejects.toThrow(HttpException);
    });

    it('sets Retry-After header on 429 response', async () => {
      const setHeader = jest.fn();
      const context = buildContext({ setHeader });
      const limitDetail = {
        totalHits: 11,
        timeToExpire: 42,
        isBlocked: true,
        timeToBlockExpire: 42,
        limit: 10,
        ttl: 60_000,
        key: 'test-key',
        tracker: '192.168.1.1',
      };

      try {
        await (guard as any).throwThrottlingException(context, limitDetail);
      } catch {
        // expected
      }

      expect(setHeader).toHaveBeenCalledWith('Retry-After', 42);
    });

    it('includes retryAfter in exception response body', async () => {
      const setHeader = jest.fn();
      const context = buildContext({ setHeader });
      const limitDetail = {
        totalHits: 11,
        timeToExpire: 30,
        isBlocked: true,
        timeToBlockExpire: 30,
        limit: 10,
        ttl: 60_000,
        key: 'test-key',
        tracker: '192.168.1.1',
      };

      let thrown: HttpException | undefined;
      try {
        await (guard as any).throwThrottlingException(context, limitDetail);
      } catch (e) {
        thrown = e as HttpException;
      }

      expect(thrown).toBeDefined();
      expect(thrown!.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);

      const body = thrown!.getResponse() as any;
      expect(body.retryAfter).toBe(30);
      expect(body.message).toContain('30 seconds');
    });

    it('includes requestId and timestamp in exception body', async () => {
      const setHeader = jest.fn();
      const context = buildContext({ setHeader });
      const limitDetail = {
        totalHits: 11,
        timeToExpire: 10,
        isBlocked: true,
        timeToBlockExpire: 10,
        limit: 10,
        ttl: 60_000,
        key: 'test-key',
        tracker: '192.168.1.1',
      };

      let thrown: HttpException | undefined;
      try {
        await (guard as any).throwThrottlingException(context, limitDetail);
      } catch (e) {
        thrown = e as HttpException;
      }

      const body = thrown!.getResponse() as any;
      expect(body.requestId).toBe('test-request-id');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('canActivate — @ThrottleByApiKey metadata propagation', () => {
    it('sets _throttleByApiKey on request when decorator is applied', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === THROTTLE_BY_API_KEY) return true;
        return undefined;
      });

      storageService.increment.mockResolvedValue(buildStorageRecord());

      const context = buildContext({
        headers: { 'x-api-key': 'my-key' },
        ip: '10.5.0.1',
      });
      const req = context.switchToHttp().getRequest();

      // canActivate modifies req before delegating to base class
      // We spy on super.canActivate to avoid full throttler pipeline
      jest
        .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockResolvedValueOnce(true);

      await guard.canActivate(context);

      expect(req._throttleByApiKey).toBe(true);
    });
  });

  describe('rate limit headers', () => {
    it('adds X-RateLimit-Limit and X-RateLimit-Remaining headers on allowed requests', async () => {
      const setHeader = jest.fn();
      const context = buildContext({ setHeader, ip: '10.5.0.1' });

      storageService.increment.mockResolvedValue(
        buildStorageRecord({ totalHits: 5, timeToExpire: 45 }),
      );

      await guard.canActivate(context);

      // The base ThrottlerGuard sets these headers; verify they are called
      // with the right throttler name suffix for named throttlers
      expect(setHeader).toHaveBeenCalledWith(
        expect.stringContaining('X-RateLimit-Limit'),
        expect.any(Number),
      );
      expect(setHeader).toHaveBeenCalledWith(
        expect.stringContaining('X-RateLimit-Remaining'),
        expect.any(Number),
      );
    });
  });
});
