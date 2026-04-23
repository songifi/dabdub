import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const SENSITIVE_FIELDS = new Set(['password', 'apiKey', 'secret', 'apiKeyHash', 'passwordHash']);

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = SENSITIVE_FIELDS.has(k) ? '[REDACTED]' : v;
  }
  return result;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url, user } = req;
    const merchantId: string | undefined = user?.merchantId;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const statusCode: number = res.statusCode;
          const duration = Date.now() - start;
          const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'log';
          this.logger[level](
            JSON.stringify(sanitize({ method, url, statusCode, duration, merchantId })),
          );
        },
        error: (err: { status?: number; message?: string }) => {
          const statusCode = err.status ?? 500;
          const duration = Date.now() - start;
          const level = statusCode >= 500 ? 'error' : 'warn';
          this.logger[level](
            JSON.stringify({ method, url, statusCode, duration, merchantId, error: err.message }),
          );
        },
      }),
    );
  }
}
