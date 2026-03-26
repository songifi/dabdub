import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, lastValueFrom } from 'rxjs';
import { AuditInterceptor, AUDIT_KEY, AuditMeta } from './audit.interceptor';
import { AuditService } from './audit.service';
import { ActorType } from './entities/audit-log.entity';

const makeContext = (
  method: string,
  params: Record<string, string>,
  user: { id: string; role: string },
  meta: AuditMeta | undefined,
): ExecutionContext => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(meta) } as any;
  const req = {
    method,
    ip: '10.0.0.1',
    headers: { 'user-agent': 'test-agent' },
    params,
    correlationId: 'corr-abc',
    user,
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => ({}),
    getClass: () => ({}),
    _reflector: reflector,
  } as any;
};

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditService: jest.Mocked<AuditService>;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    auditService = {
      log: jest.fn().mockResolvedValue({}),
      findById: jest.fn(),
      findAll: jest.fn(),
    } as any;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    interceptor = new AuditInterceptor(auditService, reflector);
  });

  it('should skip logging when no @Audit() meta is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeContext('PATCH', { id: '1' }, { id: 'a1', role: 'admin' }, undefined);
    const next = { handle: () => of({ ok: true }) };

    const result = await lastValueFrom(interceptor.intercept(ctx, next));
    expect(result).toEqual({ ok: true });
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('should log with correct actorType ADMIN for admin role', async () => {
    const meta: AuditMeta = { action: 'user.freeze', resourceType: 'user', resourceIdParam: 'id' };
    reflector.getAllAndOverride.mockReturnValue(meta);
    const ctx = makeContext('PATCH', { id: 'user-99' }, { id: 'admin-1', role: 'admin' }, meta);
    const handlerResult = { isActive: false };
    const next = { handle: () => of(handlerResult) };

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        actorType: ActorType.ADMIN,
        action: 'user.freeze',
        resourceType: 'user',
        resourceId: 'user-99',
        after: handlerResult,
        ipAddress: '10.0.0.1',
        userAgent: 'test-agent',
        correlationId: 'corr-abc',
      }),
    );
  });

  it('should capture before=null for non-mutating GET requests', async () => {
    const meta: AuditMeta = { action: 'user.view', resourceType: 'user', resourceIdParam: 'id' };
    reflector.getAllAndOverride.mockReturnValue(meta);
    const ctx = makeContext('GET', { id: 'user-1' }, { id: 'admin-1', role: 'admin' }, meta);
    const next = { handle: () => of({ id: 'user-1' }) };

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ before: null }),
    );
  });

  it('should resolve actorType SYSTEM when no user role', async () => {
    const meta: AuditMeta = { action: 'system.action', resourceType: 'resource', resourceIdParam: 'id' };
    reflector.getAllAndOverride.mockReturnValue(meta);
    const ctx = makeContext('PATCH', { id: 'r-1' }, { id: '', role: '' }, meta);
    const next = { handle: () => of({}) };

    await lastValueFrom(interceptor.intercept(ctx, next));

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: ActorType.SYSTEM }),
    );
  });
});
