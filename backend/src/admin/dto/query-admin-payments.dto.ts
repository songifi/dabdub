import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsNumberString,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TransactionStatus,
  TransactionType,
} from '../../transactions/entities/transaction.entity';

export class QueryAdminPaymentsDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by merchant user ID' })
  @IsOptional()
  @IsString()
  merchantId?: string;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional({
    enum: TransactionType,
    description: 'Filter by transaction network/type',
  })
  @IsOptional()
  @IsEnum(TransactionType)
  network?: TransactionType;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ example: '10.00', description: 'Minimum USDC amount' })
  @IsOptional()
  @IsNumberString()
  minAmount?: string;
}
