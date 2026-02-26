import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiKeyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Masked prefix (e.g. sk_live_••••)' })
  prefix: string;

  @ApiProperty({ example: ['payments:read', 'payments:write'] })
  scopes: string[];

  @ApiPropertyOptional({ nullable: true })
  lastUsedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  isActive: boolean;
}

export class CreatedKeySecretDto {
  @ApiProperty({
    description: 'Plaintext key — shown only once. Store securely.',
  })
  apiKey: string;

  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ example: ['payments:read', 'payments:write'] })
  scopes: string[];
}
