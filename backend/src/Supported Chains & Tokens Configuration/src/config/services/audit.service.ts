import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLog } from "../entities/audit-log.entity";

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async log(
    action: string,
    entityType: string,
    entityId: string,
    description: string,
    changes: Record<string, any>,
    userId?: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      const auditLog = this.auditRepository.create({
        action,
        entityType,
        entityId,
        description,
        changes,
        userId,
        ipAddress,
      });
      await this.auditRepository.save(auditLog);
      this.logger.debug(
        `Audit log created: ${action} for ${entityType}:${entityId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`, error);
    }
  }

  async getLogs(
    entityType?: string,
    entityId?: string,
    action?: string,
    limit: number = 100,
  ): Promise<AuditLog[]> {
    let query = this.auditRepository.createQueryBuilder("audit");

    if (entityType)
      query = query.where("audit.entityType = :entityType", { entityType });
    if (entityId)
      query = query.andWhere("audit.entityId = :entityId", { entityId });
    if (action) query = query.andWhere("audit.action = :action", { action });

    return query.orderBy("audit.createdAt", "DESC").take(limit).getMany();
  }
}
