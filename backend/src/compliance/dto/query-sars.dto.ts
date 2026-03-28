import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsUUID, Min } from 'class-validator';
import { SarStatus } from '../entities/suspicious-activity-report.entity';

export class QuerySarsDto {
  @IsOptional()
  @IsEnum(SarStatus)
  status?: SarStatus;

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
