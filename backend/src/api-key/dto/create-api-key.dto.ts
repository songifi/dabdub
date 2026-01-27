import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateApiKeyDto {
  @IsOptional()
  @IsArray()
  scopes?: string[];

  @IsOptional()
  @IsArray()
  ipWhitelist?: string[];
}
