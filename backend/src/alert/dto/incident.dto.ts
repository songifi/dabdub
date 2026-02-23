import {
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
  IsArray,
  MinLength,
} from 'class-validator';
import {
  IncidentSeverity,
  IncidentStatus,
  TimelineEntryType,
} from '../enums/incident.enums';

export class CreateIncidentDto {
  @IsString()
  @MinLength(10)
  title: string;

  @IsString()
  @MinLength(20)
  description: string;

  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsArray()
  @IsString({ each: true })
  affectedServices: string[];
}

export class UpdateIncidentDto {
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;
}

export class AddTimelineEntryDto {
  @IsEnum(TimelineEntryType)
  type: TimelineEntryType;

  @IsString()
  @MinLength(5)
  content: string;
}

export class ResolveIncidentDto {
  @IsString()
  @MinLength(20)
  resolutionNote: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsOptional()
  @IsString()
  preventionActions?: string;
}

export class ListIncidentsQueryDto {
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsEnum(IncidentSeverity)
  severity?: IncidentSeverity;

  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  createdAfter?: string;
}
