import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { HttpLoggingInterceptor } from './http-logging.interceptor';

describe('HttpLoggingInterceptor', () => {
  it('logs required fields on request completion', (done) => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    const interceptor = new HttpLoggingInterceptor(logger);

    const req = {
      method: 'GET',
      originalUrl: '/v1/notifications',
      correlationId: 'cid-123',
      user: { id: 'user-1' },
    };
    const res = { statusCode: 200 };

    const ctx: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as any;

    const next: CallHandler = {
      handle: () => of({ ok: true }),
    };

    interceptor.intercept(ctx, next).subscribe({
      next: () => {},
      error: (err) => done(err),
      complete: () => {
        expect(logger.info).toHaveBeenCalled();
        const [, meta] = logger.info.mock.calls[0];

        expect(meta).toEqual(
          expect.objectContaining({
            method: 'GET',
            path: '/v1/notifications',
            statusCode: 200,
            userId: 'user-1',
            correlationId: 'cid-123',
          }),
        );
        expect(typeof meta.latencyMs).toBe('number');
        done();
      },
    });
  });
});

