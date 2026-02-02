import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycAuditLog, AuditAction } from '../entities/kyc-audit-log.entity';

@Injectable()
export class KycAuditService {
  private readonly logger = new Logger(KycAuditService.name);

  constructor(
    @InjectRepository(KycAuditLog)
    private readonly auditLogRepository: Repository<KycAuditLog>,
  ) {}

  async logAction(
    kycVerificationId: string,
    action: AuditAction,
    description: string,
    userId?: string,
    userType?: string,
    oldValues?: any,
    newValues?: any,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
    requestId?: string,
  ): Promise<KycAuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        kycVerificationId,
        action,
        description,
        userId,
        userType: userType || 'system',
        oldValues: oldValues ? this.sanitizeData(oldValues) : null,
        newValues: newValues ? this.sanitizeData(newValues) : null,
        changedFields: this.getChangedFields(oldValues, newValues),
        metadata: metadata || {},
        ipAddress,
        userAgent,
        requestId,
        complianceRelevant: this.isComplianceRelevant(action),
        sensitiveDataAccessed: this.containsSensitiveData(oldValues, newValues),
        dataRetentionDate: this.calculateRetentionDate(action),
      });

      const savedLog = await this.auditLogRepository.save(auditLog);
      
      this.logger.log(
        `Audit log created: ${action} for verification ${kycVerificationId} by ${userType}:${userId}`,
      );

      return savedLog;
    } catch (error) {
      this.logger.error(
        `Failed to create audit log: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getAuditLogs(
    kycVerificationId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<KycAuditLog[]> {
    return this.auditLogRepository.find({
      where: { kycVerificationId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getAuditLogsByAction(
    action: AuditAction,
    limit: number = 100,
    offset: number = 0,
  ): Promise<KycAuditLog[]> {
    return this.auditLogRepository.find({
      where: { action },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getAuditLogsByUser(
    userId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<KycAuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async getComplianceAuditLogs(
    startDate: Date,
    endDate: Date,
    limit: number = 1000,
    offset: number = 0,
  ): Promise<KycAuditLog[]> {
    return this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.complianceRelevant = :complianceRelevant', { complianceRelevant: true })
      .andWhere('audit.createdAt >= :startDate', { startDate })
      .andWhere('audit.createdAt <= :endDate', { endDate })
      .orderBy('audit.createdAt', 'DESC')
      .limit(limit)
      .offset(offset)
      .getMany();
  }

  async cleanupExpiredLogs(): Promise<number> {
    const result = await this.auditLogRepository
      .createQueryBuilder()
      .delete()
      .where('dataRetentionDate < :now', { now: new Date() })
      .execute();

    const deletedCount = result.affected || 0;
    this.logger.log(`Cleaned up ${deletedCount} expired audit logs`);
    
    return deletedCount;
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password',
      'ssn',
      'socialSecurityNumber',
      'taxId',
      'bankAccountNumber',
      'routingNumber',
      'creditCardNumber',
      'cvv',
    ];

    const sanitized = { ...data };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = this.maskSensitiveData(sanitized[field]);
      }
    }

    return sanitized;
  }

  private maskSensitiveData(value: string): string {
    if (!value || typeof value !== 'string') {
      return value;
    }

    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }

    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
  }

  private getChangedFields(oldValues: any, newValues: any): string[] {
    if (!oldValues || !newValues) {
      return [];
    }

    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

    for (const key of allKeys) {
      if (oldValues[key] !== newValues[key]) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }

  private isComplianceRelevant(action: AuditAction): boolean {
    const complianceActions = [
      AuditAction.VERIFICATION_CREATED,
      AuditAction.VERIFICATION_APPROVED,
      AuditAction.VERIFICATION_REJECTED,
      AuditAction.VERIFICATION_EXPIRED,
      AuditAction.VERIFICATION_SUSPENDED,
      AuditAction.DOCUMENT_VERIFIED,
      AuditAction.DOCUMENT_REJECTED,
      AuditAction.SANCTIONS_CHECKED,
      AuditAction.RISK_ASSESSED,
      AuditAction.MANUAL_REVIEW_COMPLETED,
      AuditAction.STATUS_CHANGED,
      AuditAction.COMPLIANCE_FLAG_ADDED,
      AuditAction.COMPLIANCE_FLAG_REMOVED,
    ];

    return complianceActions.includes(action);
  }

  private containsSensitiveData(oldValues: any, newValues: any): boolean {
    const sensitiveFields = [
      'firstName',
      'lastName',
      'dateOfBirth',
      'phoneNumber',
      'addressLine1',
      'addressLine2',
      'documentNumber',
      'businessRegistrationNumber',
    ];

    const allData = { ...oldValues, ...newValues };
    
    return sensitiveFields.some(field => allData && allData[field]);
  }

  private calculateRetentionDate(action: AuditAction): Date {
    const now = new Date();
    
    // Different retention periods based on action type
    const retentionPeriods = {
      [AuditAction.VERIFICATION_APPROVED]: 7 * 365, // 7 years for approved verifications
      [AuditAction.VERIFICATION_REJECTED]: 7 * 365, // 7 years for rejected verifications
      [AuditAction.SANCTIONS_CHECKED]: 5 * 365, // 5 years for sanctions checks
      [AuditAction.RISK_ASSESSED]: 5 * 365, // 5 years for risk assessments
      [AuditAction.DOCUMENT_VERIFIED]: 7 * 365, // 7 years for document verification
      [AuditAction.COMPLIANCE_FLAG_ADDED]: 10 * 365, // 10 years for compliance flags
    };

    const retentionDays = retentionPeriods[action] || 3 * 365; // Default 3 years
    
    return new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);
  }
}