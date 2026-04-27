import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  NotAcceptableException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const CURRENT_VERSION = 'v1';
const SUPPORTED_VERSIONS = ['v1'];

/**
 * Sets X-API-Version and X-Supported-Versions headers on every response.
 * Returns 406 Not Acceptable when the client sends an unsupported
 * Accept: application/vnd.cheesepay.{version}+json header.
 */
@Injectable()
export class VersioningInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const acceptHeader: string | undefined = req.headers['accept'];

    if (acceptHeader) {
      const vndMatch = acceptHeader.match(/application\/vnd\.cheesepay\.(\w+)\+json/);
      if (vndMatch) {
        const requestedVersion = vndMatch[1];
        if (!SUPPORTED_VERSIONS.includes(requestedVersion)) {
          throw new NotAcceptableException(
            `API version '${requestedVersion}' is not supported. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}`,
          );
        }
      }
    }

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();
        res.setHeader('X-API-Version', CURRENT_VERSION);
        res.setHeader('X-Supported-Versions', SUPPORTED_VERSIONS.join(', '));
      }),
    );
  }
}
