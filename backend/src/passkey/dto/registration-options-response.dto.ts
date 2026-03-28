import { ApiProperty } from '@nestjs/swagger';

export class RegistrationOptionsResponseDto {
  @ApiProperty({
    description: 'WebAuthn registration options to pass to the client',
    type: 'object',
  })
  options!: Record<string, unknown>;

  @ApiProperty({
    description: 'Session ID to associate with the registration challenge',
    example: 'abc123',
  })
  sessionId!: string;
}
