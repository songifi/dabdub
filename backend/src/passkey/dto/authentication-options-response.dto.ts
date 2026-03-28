import { ApiProperty } from '@nestjs/swagger';

export class AuthenticationOptionsResponseDto {
  @ApiProperty({
    description: 'WebAuthn authentication options to pass to the client',
    type: 'object',
  })
  options!: Record<string, unknown>;

  @ApiProperty({
    description: 'Session ID to associate with the authentication challenge',
    example: 'abc123',
  })
  sessionId!: string;
}
