import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  MinLength,
  MaxLength,
  ValidateNested,
  Min,
  Max,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from 'src/database/entities/user.entity';
import { AlertMetric, AlertSeverity } from '../enums/alert.enums';

export class AlertConditionDto {
  @IsEnum(['gt', 'lt', 'gte', 'lte'])
  operator: 'gt' | 'lt' | 'gte' | 'lte';

  @IsNumber()
  threshold: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  windowMinutes: number;
}

export class CreateAlertRuleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name: string;

  @IsString()
  @MinLength(10)
  description: string;

  @IsEnum(AlertMetric)
  metric: AlertMetric;

  @ValidateNested()
  @Type(() => AlertConditionDto)
  conditions: AlertConditionDto;

  @IsEnum(AlertSeverity)
  severity: AlertSeverity;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  notifyRoles?: UserRole[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  cooldownMinutes?: number;

  @IsOptional()
  @IsBoolean()
  autoCreateIncident?: boolean;
}

export class UpdateAlertRuleDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(AlertMetric)
  metric?: AlertMetric;

  @IsOptional()
  @ValidateNested()
  @Type(() => AlertConditionDto)
  conditions?: AlertConditionDto;

  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  notifyRoles?: UserRole[];

  @IsOptional()
  @IsInt()
  @Min(1)
  cooldownMinutes?: number;

  @IsOptional()
  @IsBoolean()
  autoCreateIncident?: boolean;
}

export class AcknowledgeAlertDto {
  @IsString()
  @MinLength(10)
  note: string;
}

export class ResolveAlertDto {
  @IsString()
  @MinLength(20)
  resolutionNote: string;
}

export class ListAlertEventsQueryDto {
  @IsOptional()
  @IsEnum(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'AUTO_RESOLVED'])
  status?: string;

  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @IsOptional()
  @IsString()
  ruleId?: string;

  @IsOptional()
  @IsString()
  createdAfter?: string;

  @IsOptional()
  @IsString()
  createdBefore?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
