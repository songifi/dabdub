import { IsObject, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterPasskeyVerifyDto {
  @ApiProperty({
    description: 'WebAuthn registration response from the client',
    type: 'object',
    example: {
      id: 'credential-id',
      rawId: 'base64url-encoded-raw-id',
      response: {
        clientDataJSON: 'base64url-encoded-client-data',
        attestationObject: 'base64url-encoded-attestation',
        transports: ['internal', 'usb'],
      },
      type: 'public-key',
      clientExtensionResults: {},
    },
  })
  @IsObject()
  response!: Record<string, unknown>;

  @ApiProperty({
    description: 'Optional nickname for the passkey',
    example: 'My iPhone 15',
    required: false,
  })
  @IsString()
  nickname?: string;
}
