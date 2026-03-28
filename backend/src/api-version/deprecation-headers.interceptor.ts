import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import type { Response } from 'express';
import {
  DEPRECATED_ROUTE_KEY,
  type DeprecatedRouteMetadata,
} from './deprecated-route.decorator';

@Injectable()
export class DeprecationHeadersInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<
      DeprecatedRouteMetadata | undefined
    >(DEPRECATED_ROUTE_KEY, [context.getHandler(), context.getClass()]);

    if (!meta) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        if (res.headersSent) return;
        res.setHeader('Deprecation', meta.deprecatedSince.toUTCString());
        res.setHeader('Sunset', meta.sunset.toUTCString());
        res.setHeader(
          'Link',
          `<${meta.successorPath}>; rel="successor-version"`,
        );
      }),
    );
  }
}
