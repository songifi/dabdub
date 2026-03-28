import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReceivePayLinkDto {
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
}
