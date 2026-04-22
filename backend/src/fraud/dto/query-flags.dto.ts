import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FraudSeverity, FraudStatus } from '../entities/fraud-flag.entity';

export class QueryFlagsDto {
  @ApiPropertyOptional({ enum: FraudSeverity })
  @IsOptional()
  @IsEnum(FraudSeverity)
  severity?: FraudSeverity;

  @ApiPropertyOptional({ enum: FraudStatus })
  @IsOptional()
  @IsEnum(FraudStatus)
  status?: FraudStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
