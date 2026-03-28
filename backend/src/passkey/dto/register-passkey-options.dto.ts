import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterPasskeyOptionsDto {
  @ApiPropertyOptional({
    description: 'Optional nickname for the passkey',
    example: 'My iPhone 15',
  })
  @IsOptional()
  @IsString()
  nickname?: string;
}
