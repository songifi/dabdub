import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsService } from './metrics.service';

describe('HttpMetricsInterceptor', () => {
  let interceptor: HttpMetricsInterceptor;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(() => {
    metricsService = {
      recordHttpRequest: jest.fn(),
    } as unknown as jest.Mocked<MetricsService>;

    interceptor = new HttpMetricsInterceptor(metricsService);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createContext(
    req: Record<string, unknown>,
    res: Record<string, unknown>,
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
  }

  it('should record metrics on successful request', async () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/users',
      route: { path: '/api/v1/users' },
      correlationId: 'cid-1',
    };
    const res = { statusCode: 200 };

    const ctx = createContext(req, res);
    const next: CallHandler = { handle: () => of({ data: true }) };

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(metricsService.recordHttpRequest).toHaveBeenCalledTimes(1);
    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/api/v1/users',
      200,
      expect.any(Number),
    );
  });

  it('should record metrics on failed request with HttpException status', async () => {
    const req = {
      method: 'POST',
      originalUrl: '/api/v1/payments',
      route: { path: '/api/v1/payments' },
      correlationId: 'cid-2',
    };
    const res = { statusCode: 400 };

    const ctx = createContext(req, res);
    const error = Object.assign(new Error('Bad Request'), { status: 400 });
    const next: CallHandler = { handle: () => throwError(() => error) };

    await expect(lastValueFrom(interceptor.intercept(ctx, next))).rejects.toThrow('Bad Request');

    expect(metricsService.recordHttpRequest).toHaveBeenCalledTimes(1);
    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'POST',
      '/api/v1/payments',
      400,
      expect.any(Number),
    );
  });

  it('should default error status to 500 when no status is present', async () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/health',
      route: { path: '/api/v1/health' },
    };
    const res = { statusCode: 200 };

    const ctx = createContext(req, res);
    const error = new Error('Internal failure');
    const next: CallHandler = { handle: () => throwError(() => error) };

    await expect(lastValueFrom(interceptor.intercept(ctx, next))).rejects.toThrow('Internal failure');

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/api/v1/health',
      500,
      expect.any(Number),
    );
  });

  it('should fallback to originalUrl when route.path is missing', async () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/custom-route',
    };
    const res = { statusCode: 200 };

    const ctx = createContext(req, res);
    const next: CallHandler = { handle: () => of('ok') };

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/api/v1/custom-route',
      200,
      expect.any(Number),
    );
  });

  it('should fallback to unknown when no route or url is present', async () => {
    const req = { method: 'GET' };
    const res = { statusCode: 200 };

    const ctx = createContext(req, res);
    const next: CallHandler = { handle: () => of('ok') };

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(metricsService.recordHttpRequest).toHaveBeenCalledWith(
      'GET',
      'unknown',
      200,
      expect.any(Number),
    );
  });

  it('should log WARN for slow requests >1000ms on success', async () => {
    const loggerWarn = jest.spyOn(Logger.prototype, 'warn');

    const req = {
      method: 'GET',
      originalUrl: '/api/v1/slow',
      route: { path: '/api/v1/slow' },
      correlationId: 'cid-slow',
    };
    const res = { statusCode: 200 };

    const ctx = createContext(req, res);
    const next: CallHandler = {
      handle: () =>
        of('ok').pipe(
          // simulate delay
        ),
    };

    // Simulate slow execution by mocking Date.now
    let callCount = 0;
    const originalNow = Date.now;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0 : 1500;
    });

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(loggerWarn).toHaveBeenCalledWith('slow request detected', {
      event: 'slow_http_request',
      method: 'GET',
      route: '/api/v1/slow',
      status: 200,
      durationMs: 1500,
      correlationId: 'cid-slow',
    });

    jest.spyOn(Date, 'now').mockRestore();
  });

  it('should log WARN for slow requests >1000ms on error', async () => {
    const loggerWarn = jest.spyOn(Logger.prototype, 'warn');

    const req = {
      method: 'POST',
      originalUrl: '/api/v1/slow-error',
      route: { path: '/api/v1/slow-error' },
    };
    const res = { statusCode: 500 };

    const ctx = createContext(req, res);
    const error = Object.assign(new Error('Timeout'), { status: 504 });
    const next: CallHandler = { handle: () => throwError(() => error) };

    let callCount = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      return callCount === 1 ? 0 : 2500;
    });

    await expect(lastValueFrom(interceptor.intercept(ctx, next))).rejects.toThrow('Timeout');

    expect(loggerWarn).toHaveBeenCalledWith('slow request detected', {
      event: 'slow_http_request',
      method: 'POST',
      route: '/api/v1/slow-error',
      status: 504,
      durationMs: 2500,
      correlationId: null,
    });

    jest.spyOn(Date, 'now').mockRestore();
  });

  it('should not log WARN for fast requests', async () => {
    const loggerWarn = jest.spyOn(Logger.prototype, 'warn');

    const req = {
      method: 'GET',
      originalUrl: '/api/v1/fast',
      route: { path: '/api/v1/fast' },
    };
    const res = { statusCode: 200 };

    const ctx = createContext(req, res);
    const next: CallHandler = { handle: () => of('ok') };

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(loggerWarn).not.toHaveBeenCalled();
  });
});

