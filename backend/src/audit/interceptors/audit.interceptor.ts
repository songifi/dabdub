import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../audit.service';
import { AUDITABLE_KEY, AuditableOptions } from '../decorators/auditable.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditableOptions = this.reflector.get<AuditableOptions>(
      AUDITABLE_KEY,
      context.getHandler(),
    );

    if (!auditableOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const actor = request.user?.id || request.user?.sub || request.user?.email || 'anonymous';
    const ip = request.ip || request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown';

    const before = {
      body: request.body,
      query: request.query,
      params: request.params,
    };

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.auditService.log({
            actor,
            action: auditableOptions.action,
            resource: auditableOptions.resource,
            before,
            after: data,
            ip,
          }).catch(err => console.error('Failed to write audit log:', err));
        },
        error: (err) => {
          this.auditService.log({
            actor,
            action: auditableOptions.action,
            resource: auditableOptions.resource,
            before,
            after: { error: err.message, status: err.status },
            ip,
          }).catch(logErr => console.error('Failed to write audit log for error:', logErr));
        }
      }),
    );
  }
}
