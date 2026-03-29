import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
 feature/implement-4-issues
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { FeatureFlagStatus } from '../entities/feature-flag.entity';

export class CreateFeatureFlagDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Length(1, 100)
  key!: string;

  @ApiProperty({ maxLength: 500 })
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

export class CreateFeatureFlagDto {
  @ApiProperty({ example: 'virtual_cards' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
main
  description!: string;

  @ApiProperty({ enum: FeatureFlagStatus })
  @IsEnum(FeatureFlagStatus)
  status!: FeatureFlagStatus;

feature/implement-4-issues
  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledTiers?: string[] | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledUserIds?: string[] | null;

  @ApiPropertyOptional({ description: '0–100 when status=percentage' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  percentage?: number;

  @ApiPropertyOptional({ type: [String], example: ['Gold', 'Black'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledTiers?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabledUserIds?: string[];
main
}
