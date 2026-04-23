import { ApiProperty } from '@nestjs/swagger';

export class AuthTokenResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Merchant profile (password and key hashes stripped)',
  })
  merchant!: Record<string, unknown>;
}
