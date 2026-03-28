import { IsEnum, IsString, IsUUID, MinLength } from 'class-validator';
import { SarReportType } from '../entities/suspicious-activity-report.entity';

export class CreateSarDto {
  @IsUUID()
  userId!: string;

  @IsEnum(SarReportType)
  reportType!: SarReportType;

  @IsString()
  @MinLength(10)
  narrative!: string;
}
