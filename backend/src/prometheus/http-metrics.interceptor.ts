import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { MetricsService } from './metrics.service';

interface ExpressRequestWithRoute {
  method?: string;
  originalUrl?: string;
  url?: string;
  route?: { path?: string };
  correlationId?: string;
}

interface ExpressResponseLike {
  statusCode?: number;
}

function resolveRoute(req: ExpressRequestWithRoute): string {
  const routePath = req.route?.path;
  if (routePath && typeof routePath === 'string') {
    return routePath;
  }
  return req.originalUrl ?? req.url ?? 'unknown';
}

function resolveStatusFromError(err: unknown): number {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e.status === 'number') return e.status;
    if (typeof e.statusCode === 'number') return e.statusCode;
  }
  return 500;
}

const SLOW_REQUEST_THRESHOLD_MS = 1000;

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpMetricsInterceptor.name);

  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<ExpressRequestWithRoute>();
    const res = http.getResponse<ExpressResponseLike>();

    const start = Date.now();
    const method = req?.method ?? 'UNKNOWN';
    const route = resolveRoute(req);
    const correlationId = req?.correlationId;

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - start;
        const status = res?.statusCode ?? 0;
        this.metricsService.recordHttpRequest(method, route, status, durationMs);

        if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
          this.logger.warn('slow request detected', {
            event: 'slow_http_request',
            method,
            route,
            status,
            durationMs,
            correlationId: correlationId ?? null,
          });
        }
      }),
      catchError((err: unknown) => {
        const durationMs = Date.now() - start;
        const status = resolveStatusFromError(err);
        this.metricsService.recordHttpRequest(method, route, status, durationMs);

        if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
          this.logger.warn('slow request detected', {
            event: 'slow_http_request',
            method,
            route,
            status,
            durationMs,
            correlationId: correlationId ?? null,
          });
        }

        return throwError(() => err);
      }),
    );
  }
}

