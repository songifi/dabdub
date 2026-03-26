import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FraudSeverity, FraudStatus } from '../entities/fraud-flag.entity';

export class QueryFlagsDto {
  @ApiPropertyOptional({ enum: FraudSeverity, example: FraudSeverity.HIGH, description: 'Filter by severity level' })
  @IsOptional()
  @IsEnum(FraudSeverity)
  severity?: FraudSeverity;

  @ApiPropertyOptional({ enum: FraudStatus, example: FraudStatus.OPEN, description: 'Filter by flag status' })
  @IsOptional()
  @IsEnum(FraudStatus)
  status?: FraudStatus;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-...', description: 'Filter by user UUID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: 1, description: 'Page number (1-based)', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Items per page', minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
