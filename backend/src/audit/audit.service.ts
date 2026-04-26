import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface AuditLogDto {
  actor: string;
  action: string;
  resource: string;
  before?: any;
  after?: any;
  ip?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async log(dto: AuditLogDto): Promise<void> {
    const auditLog = this.auditLogRepo.create({
      actor: dto.actor,
      action: dto.action,
      resource: dto.resource,
      before: dto.before,
      after: dto.after,
      ip: dto.ip,
    });

    await this.auditLogRepo.save(auditLog);
  }
}
