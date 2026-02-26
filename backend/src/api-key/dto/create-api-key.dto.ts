import { IsArray, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Production key' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: ['payments:read', 'payments:write', 'settlements:read'] })
  @IsOptional()
  @IsArray()
  scopes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  ipWhitelist?: string[];
}
