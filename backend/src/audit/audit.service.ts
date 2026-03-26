import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async log(adminId: string, action: string, detail: string, ipAddress?: string): Promise<AuditLog> {
    const log = this.auditLogRepo.create({
      adminId,
      action,
      detail,
      ipAddress: ipAddress ?? null,
    });
    return this.auditLogRepo.save(log);
  }
}
