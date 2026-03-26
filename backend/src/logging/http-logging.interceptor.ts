import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import type { Logger } from 'winston';

type RequestLike = {
  method?: string;
  originalUrl?: string;
  url?: string;
  correlationId?: string;
  user?: { id?: string };
};

type ResponseLike = { statusCode?: number };

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestLike>();
    const res = http.getResponse<ResponseLike>();

    const start = Date.now();
    const method = req?.method ?? 'UNKNOWN';
    const path = req?.originalUrl ?? req?.url ?? '';
    const correlationId = req?.correlationId;
    const userId = req?.user?.id;

    return next.handle().pipe(
      tap(() => {
        const latencyMs = Date.now() - start;
        const statusCode = res?.statusCode ?? 0;

        const entry = {
          event: 'http_request_completed',
          method,
          path,
          statusCode,
          latencyMs,
          userId: userId ?? null,
          correlationId: correlationId ?? null,
        };

        if (statusCode >= 500) this.logger.error('request completed', entry);
        else if (statusCode >= 400)
          this.logger.warn('request completed', entry);
        else this.logger.info('request completed', entry);
      }),
      catchError((err) => {
        const latencyMs = Date.now() - start;
        const statusCode = res?.statusCode ?? 0;

        this.logger.error('request failed', {
          event: 'http_request_failed',
          method,
          path,
          statusCode,
          latencyMs,
          userId: userId ?? null,
          correlationId: correlationId ?? null,
          errorName: err?.name,
          errorMessage: err?.message,
        });

        return throwError(() => err);
      }),
    );
  }
}
