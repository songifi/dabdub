import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiScope, API_KEY_SCOPES } from '../../auth/scopes';

export class GenerateApiKeyDto {
  @ApiPropertyOptional({ type: [String], enum: API_KEY_SCOPES, description: 'Scopes to assign to the generated API key' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsIn(API_KEY_SCOPES, { each: true })
  scopes?: ApiScope[];
}
