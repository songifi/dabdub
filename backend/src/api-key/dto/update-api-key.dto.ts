import { IsArray, IsOptional } from 'class-validator';

export class UpdateApiKeyDto {
  @IsOptional()
  @IsArray()
  scopes?: string[];

  @IsOptional()
  @IsArray()
  ipWhitelist?: string[];
}
