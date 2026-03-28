import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePayLinkDto {
  @ApiProperty({ example: '25.50' })
  @IsString()
  @MaxLength(64)
  amount!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @ApiPropertyOptional({ default: 72, maximum: 720 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(720)
  expiresInHours?: number;

  @ApiPropertyOptional({
    description:
      'Optional custom slug: alphanumeric and hyphens, 4 to 32 chars',
    example: 'inv-2026-001',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9-]{4,32}$/, {
    message: 'customSlug must be alphanumeric/hyphen and 4-32 chars',
  })
  customSlug?: string;
}
