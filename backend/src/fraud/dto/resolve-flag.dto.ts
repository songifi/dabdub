import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FraudStatus } from '../entities/fraud-flag.entity';

const RESOLVABLE = [FraudStatus.RESOLVED, FraudStatus.FALSE_POSITIVE] as const;
type ResolvableStatus = (typeof RESOLVABLE)[number];

export class ResolveFlagDto {
  @ApiProperty({ enum: RESOLVABLE })
  @IsEnum(RESOLVABLE)
  resolution!: ResolvableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
