import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import {
  AuditAction,
  ActorType,
  DataClassification,
} from '../database/entities/audit-log.enums';

const SENSITIVE_FIELDS = [
  'password',
  'ssn',
  'socialSecurityNumber',
  'taxId',
  'bankAccountNumber',
  'routingNumber',
  'creditCardNumber',
  'cvv',
  'privateKey',
  'secret',
  'token',
];

export interface AuditLogPayload {
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorId: string;
  actorType: ActorType;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown> | null;
  dataClassification?: DataClassification;
  retentionDays?: number;
}

export interface AuditLogSearchParams {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: AuditAction;
  requestId?: string;
  dataClassification?: DataClassification;
  startDate?: Date;
  endDate?: Date;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
  ) {}

  async log(payload: AuditLogPayload): Promise<AuditLogEntity> {
    const beforeState = payload.beforeState
      ? this.maskSensitiveFields(payload.beforeState)
      : null;
    const afterState = payload.afterState
      ? this.maskSensitiveFields(payload.afterState)
      : null;

    const retentionUntil = payload.retentionDays
      ? new Date(
          Date.now() + payload.retentionDays * 24 * 60 * 60 * 1000,
        )
      : null;

    const auditLog = this.auditLogRepository.create({
      entityType: payload.entityType,
      entityId: payload.entityId,
      action: payload.action,
      actorId: payload.actorId,
      actorType: payload.actorType,
      beforeState,
      afterState,
      ipAddress: payload.ipAddress ?? null,
      userAgent: payload.userAgent ?? null,
      requestId: payload.requestId ?? null,
      metadata: payload.metadata ?? null,
      dataClassification: payload.dataClassification ?? DataClassification.NORMAL,
      retentionUntil,
    });

    const saved = await this.auditLogRepository.save(auditLog);
    this.logger.debug(
      `Audit: ${payload.action} ${payload.entityType}:${payload.entityId} by ${payload.actorType}:${payload.actorId}`,
    );
    return saved;
  }

  async search(params: AuditLogSearchParams): Promise<{
    data: AuditLogEntity[];
    total: number;
  }> {
    const qb = this.auditLogRepository.createQueryBuilder('audit');

    if (params.entityType) {
      qb.andWhere('audit.entityType = :entityType', {
        entityType: params.entityType,
      });
    }
    if (params.entityId) {
      qb.andWhere('audit.entityId = :entityId', { entityId: params.entityId });
    }
    if (params.actorId) {
      qb.andWhere('audit.actorId = :actorId', { actorId: params.actorId });
    }
    if (params.action) {
      qb.andWhere('audit.action = :action', { action: params.action });
    }
    if (params.requestId) {
      qb.andWhere('audit.requestId = :requestId', {
        requestId: params.requestId,
      });
    }
    if (params.dataClassification) {
      qb.andWhere('audit.dataClassification = :dataClassification', {
        dataClassification: params.dataClassification,
      });
    }
    if (params.startDate) {
      qb.andWhere('audit.createdAt >= :startDate', {
        startDate: params.startDate,
      });
    }
    if (params.endDate) {
      qb.andWhere('audit.createdAt <= :endDate', { endDate: params.endDate });
    }
    if (!params.includeArchived) {
      qb.andWhere('audit.archivedAt IS NULL');
    }

    const total = await qb.getCount();

    qb.orderBy('audit.createdAt', 'DESC');
    qb.take(params.limit ?? 100);
    qb.skip(params.offset ?? 0);

    const data = await qb.getMany();

    return { data, total };
  }

  async markArchived(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;

    const result = await this.auditLogRepository
      .createQueryBuilder()
      .update(AuditLogEntity)
      .set({ archivedAt: new Date() })
      .where('id IN (:...ids)', { ids })
      .andWhere('archivedAt IS NULL')
      .execute();

    return result.affected ?? 0;
  }

  async archiveOlderThan(date: Date): Promise<number> {
    const result = await this.auditLogRepository
      .createQueryBuilder()
      .update(AuditLogEntity)
      .set({ archivedAt: new Date() })
      .where('createdAt < :date', { date })
      .andWhere('archivedAt IS NULL')
      .execute();

    const count = result.affected ?? 0;
    if (count > 0) {
      this.logger.log(`Archived ${count} audit logs older than ${date.toISOString()}`);
    }
    return count;
  }

  private maskSensitiveFields(data: Record<string, unknown>): Record<string, unknown> {
    if (!data || typeof data !== 'object') return data;

    const masked = { ...data };

    for (const field of SENSITIVE_FIELDS) {
      if (field in masked && masked[field] != null) {
        const val = masked[field];
        masked[field] =
          typeof val === 'string' ? this.maskString(val) : '[REDACTED]';
      }
    }

    return masked;
  }

  private maskString(value: string): string {
    if (!value || typeof value !== 'string') return value;
    if (value.length <= 4) return '*'.repeat(value.length);
    return (
      value.substring(0, 2) +
      '*'.repeat(Math.max(0, value.length - 4)) +
      value.substring(value.length - 2)
    );
  }
}
