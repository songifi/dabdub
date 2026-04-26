import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'merchant@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.trim())
  email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @Transform(({ value }) => value?.trim())
  businessName: string;

  @ApiPropertyOptional({ example: 'retail' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  businessType?: string;

  @ApiPropertyOptional({ example: 'NG' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  country?: string;
}
