import { IsArray, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateApiKeyDto {
  @IsOptional()
  @IsArray()
  scopes?: string[];

  @IsOptional()
  @IsArray()
  ipWhitelist?: string[];
}

export class UpdateScopesDto {
  @ApiProperty({ example: ['payments:read', 'payments:write', 'settlements:read'] })
  @IsArray()
  scopes: string[];
}

export class WhitelistDto {
  @ApiProperty({ example: ['192.168.1.1'], type: [String] })
  @IsArray()
  ips: string[];
}
