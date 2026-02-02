import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  Min,
} from 'class-validator';

export enum SettlementSchedule {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MANUAL = 'manual',
  THRESHOLD = 'threshold',
}

export class SettlementPreferencesDto {
  @ApiPropertyOptional({
    description: 'Settlement schedule preference',
    enum: SettlementSchedule,
    example: SettlementSchedule.DAILY,
  })
  @IsOptional()
  @IsEnum(SettlementSchedule)
  schedule?: SettlementSchedule;

  @ApiPropertyOptional({
    description:
      'Threshold amount for triggering settlement (if schedule is threshold)',
    example: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  thresholdAmount?: number;

  @ApiPropertyOptional({
    description: 'Preferred currency for settlement',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description:
      'Automatically convert incoming payments to preferred currency',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  autoConvert?: boolean;
}
