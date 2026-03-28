import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating user profile
 * - displayName: optional, max 50 characters
 * - phone: optional, E.164 format (e.g., +234801234567)
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Display name, max 50 characters',
    example: 'John Doe',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Phone number in E.164 format',
    example: '+234801234567',
    pattern: '^\\+[1-9]\\d{1,14}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone must be in E.164 format (e.g., +234801234567)',
  })
  phone?: string;
}
