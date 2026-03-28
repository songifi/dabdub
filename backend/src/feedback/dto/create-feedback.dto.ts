import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { FeedbackType } from '../entities/feedback.entity';

export class CreateFeedbackDto {
  @ApiProperty({ enum: FeedbackType })
  @IsEnum(FeedbackType)
  type!: FeedbackType;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  npsScore?: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({
    description: 'Additional context from client (screen, feature flags, etc.)',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  appVersion?: string;

  @ApiPropertyOptional({ maxLength: 32, example: 'ios' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;
}