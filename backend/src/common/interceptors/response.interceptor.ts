import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { SKIP_RESPONSE_WRAP_KEY } from '../decorators/skip-response-wrap.decorator';
import { PAGINATED_KEY } from '../decorators/paginated.decorator';
import { API_RESPONSE_MESSAGE_KEY } from '../decorators/api-response.decorator';
import type {
  ResponseEnvelope,
  RawPaginatedResponse,
  PaginationMeta,
} from '../dto/response.dto';

interface RequestWithCorrelation extends Request {
  correlationId?: string;
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithCorrelation>();
    const res = http.getResponse<Response>();

    const start = Date.now();
    const correlationId = req?.correlationId || '';
    const requestId = correlationId;

    // Check if response wrapping should be skipped
    const skipWrap = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_WRAP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Get custom success message if set
    const customMessage = this.reflector.getAllAndOverride<string | undefined>(
      API_RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Check if response is paginated
    const isPaginated = this.reflector.getAllAndOverride<boolean>(PAGINATED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map((data) => {
        // Add response timing header
        const responseTime = Date.now() - start;
        res.setHeader('X-Response-Time', `${responseTime}ms`);

        // Skip wrapping for specific routes
        if (skipWrap) {
          return data;
        }

        // Skip wrapping for streaming responses and file downloads
        if (data instanceof StreamableFile) {
          return data;
        }

        // Handle paginated responses
        if (isPaginated && this.isPaginatedResponse(data)) {
          const paginatedData = data as RawPaginatedResponse;
          const envelope: ResponseEnvelope = {
            success: true,
            data: paginatedData.data,
            message: customMessage,
            meta: {
              limit: paginatedData.limit,
              hasMore: paginatedData.hasMore,
              page: paginatedData.page,
              total: paginatedData.total,
              nextCursor: paginatedData.nextCursor,
            },
            timestamp: new Date().toISOString(),
            requestId,
          };
          return envelope;
        }

        // Handle regular responses
        const envelope: ResponseEnvelope = {
          success: true,
          data,
          message: customMessage,
          timestamp: new Date().toISOString(),
          requestId,
        };

        return envelope;
      }),
    );
  }

  /**
   * Check if response has paginated structure
   */
  private isPaginatedResponse(data: unknown): data is RawPaginatedResponse {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const obj = data as Record<string, unknown>;
    return (
      'data' in obj &&
      Array.isArray(obj.data) &&
      'limit' in obj &&
      typeof obj.limit === 'number' &&
      'hasMore' in obj &&
      typeof obj.hasMore === 'boolean'
    );
  }
}
