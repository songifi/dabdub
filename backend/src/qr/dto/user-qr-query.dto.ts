import {
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UserQrQueryDto {
  @ApiPropertyOptional({ example: '50', description: 'Optional amount label for the QR' })
  @IsOptional()
  @IsNumberString()
  amount?: string;

  @ApiPropertyOptional({ example: 'lunch', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
