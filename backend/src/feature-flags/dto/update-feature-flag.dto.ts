import { ApiPropertyOptional } from '@nestjs/swagger';
 feature/implement-4-issues
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { FeatureFlagStatus } from '../entities/feature-flag.entity';

export class UpdateFeatureFlagDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(1, 500)

import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FeatureFlagStatus } from '../entities/feature-flag.entity';

export class UpdateFeatureFlagDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
 main
  description?: string;

  @ApiPropertyOptional({ enum: FeatureFlagStatus })
  @IsOptional()
  @IsEnum(FeatureFlagStatus)
  status?: FeatureFlagStatus;

 feature/implement-4-issues
  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
 main
  @Min(0)
  @Max(100)
  percentage?: number | null;

 feature/implement-4-issues
  @ApiPropertyOptional({ type: [String], nullable: true })
  @ApiPropertyOptional({ type: [String] })
 main
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledTiers?: string[] | null;

 feature/implement-4-issues
  @ApiPropertyOptional({ type: [String], nullable: true })

  @ApiPropertyOptional({ type: [String] })
main
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledUserIds?: string[] | null;
}
