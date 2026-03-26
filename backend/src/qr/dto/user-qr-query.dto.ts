import {
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UserQrQueryDto {
  @ApiPropertyOptional({ example: '50.00', description: 'Pre-filled payment amount in USD' })
  @IsOptional()
  @IsNumberString()
  amount?: string;

  @ApiPropertyOptional({ example: 'Lunch split', description: 'Optional payment note (max 200 chars)', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
