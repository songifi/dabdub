import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from '../cache/cache.service';

const IDEMPOTENCY_TTL = 86_400; // 24 hours in seconds
const KEY_PREFIX = 'idempotency:payment:';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(private readonly cacheService: CacheService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey: string | undefined =
      request.headers['idempotency-key'];

    if (!idempotencyKey) {
      return next.handle();
    }

    const cacheKey = `${KEY_PREFIX}${idempotencyKey}`;
    const cached = await this.cacheService.get<{
      status: number;
      body: unknown;
    }>(cacheKey);

    if (cached) {
      this.logger.log(`Idempotency cache hit for key: ${idempotencyKey}`);
      const response = context.switchToHttp().getResponse();
      response.status(cached.status ?? HttpStatus.CREATED);
      return of(cached.body);
    }

    return next.handle().pipe(
      tap(async (body) => {
        const response = context.switchToHttp().getResponse();
        await this.cacheService.set(
          cacheKey,
          { status: response.statusCode ?? HttpStatus.CREATED, body },
          { ttl: IDEMPOTENCY_TTL },
        );
      }),
    );
  }
}
