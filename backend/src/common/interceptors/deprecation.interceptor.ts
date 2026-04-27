import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DEPRECATED_METADATA_KEY, DeprecatedOptions } from '../decorators/deprecated.decorator';

/**
 * Reads @Deprecated() metadata and injects RFC 8594 deprecation headers:
 *   - Deprecation: true
 *   - Sunset: <ISO date>
 *   - Link: <migration URL>; rel="successor-version"
 *   - X-Deprecation-Notice: <human-readable message>
 */
@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<DeprecatedOptions | undefined>(
      DEPRECATED_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', options.sunsetDate);
        res.setHeader('Link', `${options.link}; rel="successor-version"`);
        res.setHeader('X-Deprecation-Notice', options.message);
      }),
    );
  }
}
