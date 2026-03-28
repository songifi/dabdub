import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, switchMap } from 'rxjs';
import { AuditService } from './audit.service';
import { ActorType } from './entities/audit-log.entity';

export const AUDIT_KEY = 'audit_meta';

export interface AuditMeta {
  action: string;
  resourceType: string;
  /** Express param name that holds the resource ID, e.g. 'id' */
  resourceIdParam?: string;
}

/** Decorate a controller method to enable audit logging. */
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);

type AuditRequest = {
  method?: string;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  params?: Record<string, string>;
  correlationId?: string;
  user?: { id?: string; role?: string };
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Only intercept routes decorated with @Audit()
    if (!meta) return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<AuditRequest>();
    const method = req.method?.toUpperCase() ?? '';

    // Only capture before-state for mutating methods
    const isMutating = ['PATCH', 'PUT', 'DELETE'].includes(method);

    const resourceId = meta.resourceIdParam
      ? (req.params?.[meta.resourceIdParam] ?? '')
      : '';

    const actorId = req.user?.id ?? 'system';
    const actorType = this.resolveActorType(req.user?.role);
    const ipAddress = req.ip ?? null;
    const userAgent = (req.headers?.['user-agent'] as string | undefined) ?? null;
    const correlationId = req.correlationId ?? null;

    const captureSnapshot = async (): Promise<Record<string, unknown> | null> => {
      if (!isMutating || !resourceId) return null;
      try {
        const log = await this.auditService.findById(resourceId).catch(() => null);
        // findById is for AuditLog itself; for other resources we return null
        // The interceptor captures the handler's return value as "after"
        return log ? (log as unknown as Record<string, unknown>) : null;
      } catch {
        return null;
      }
    };

    return from(captureSnapshot()).pipe(
      switchMap((before) =>
        next.handle().pipe(
          switchMap((result) =>
            from(
              this.auditService
                .log({
                  actorId,
                  actorType,
                  action: meta.action,
                  resourceType: meta.resourceType,
                  resourceId,
                  before,
                  after: result ? (result as Record<string, unknown>) : null,
                  ipAddress,
                  userAgent,
                  correlationId,
                })
                .then(() => result),
            ),
          ),
        ),
      ),
    );
  }

  private resolveActorType(role?: string): ActorType {
    if (!role) return ActorType.SYSTEM;
    if (role === 'admin' || role === 'superadmin' || role === 'super_admin') return ActorType.ADMIN;
    return ActorType.USER;
  }
}
