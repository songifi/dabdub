import { IsObject, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AuthenticatePasskeyDto {
  @ApiProperty({
    description: 'WebAuthn authentication response from the client',
    type: 'object',
    example: {
      id: 'credential-id',
      rawId: 'base64url-encoded-raw-id',
      response: {
        clientDataJSON: 'base64url-encoded-client-data',
        authenticatorData: 'base64url-encoded-authenticator-data',
        signature: 'base64url-encoded-signature',
        userHandle: 'base64url-encoded-user-handle',
      },
      type: 'public-key',
      clientExtensionResults: {},
    },
  })
  @IsObject()
  response!: Record<string, unknown>;

  @ApiProperty({
    description: 'Session ID from the authentication options request',
    example: 'abc123',
  })
  @IsString()
  sessionId!: string;
}
