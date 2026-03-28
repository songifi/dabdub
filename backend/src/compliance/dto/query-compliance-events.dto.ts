import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID, Min } from 'class-validator';
import { ComplianceEventStatus, ComplianceEventType, ComplianceEventSeverity } from '../entities/compliance-event.entity';

export class QueryComplianceEventsDto {
  @IsOptional()
  @IsEnum(ComplianceEventStatus)
  status?: ComplianceEventStatus;

  @IsOptional()
  @IsEnum(ComplianceEventType)
  eventType?: ComplianceEventType;

  @IsOptional()
  @IsEnum(ComplianceEventSeverity)
  severity?: ComplianceEventSeverity;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit: number = 20;
}
