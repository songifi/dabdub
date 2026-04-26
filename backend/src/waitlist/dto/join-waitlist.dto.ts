import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class JoinWaitlistDto {
  @ApiProperty({ example: 'founder@example.com' })
  @IsEmail()
  @Transform(({ value }) => value?.trim())
  email!: string;

  @ApiPropertyOptional({ example: 'acme_corp' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  username?: string;

  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  businessName?: string;

  @ApiPropertyOptional({ example: 'NG' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  country?: string;
}
