import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { AuditLogService } from './audit-log.service';
import { AuditArchivalService } from './audit-archival.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  providers: [AuditLogService, AuditArchivalService],
  exports: [AuditLogService],
})
export class AuditModule {}
