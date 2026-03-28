import { ApiProperty } from '@nestjs/swagger';
import { PasskeyCredential, PasskeyDeviceType } from '../entities/passkey-credential.entity';

export class PasskeyCredentialResponseDto {
  @ApiProperty({
    description: 'Credential UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Base64url-encoded credential ID',
    example: 'AQIDBAUGBwgJCgsMDQ4PEA',
  })
  credentialId!: string;

  @ApiProperty({
    description: 'Device type (single-device or multi-device)',
    enum: PasskeyDeviceType,
    example: PasskeyDeviceType.MULTI_DEVICE,
  })
  deviceType!: PasskeyDeviceType;

  @ApiProperty({
    description: 'Whether the credential is backed up',
    example: true,
  })
  backedUp!: boolean;

  @ApiProperty({
    description: 'Supported authenticator transports',
    example: ['internal', 'usb', 'nfc'],
    nullable: true,
  })
  transports!: string[] | null;

  @ApiProperty({
    description: 'User-defined nickname for the credential',
    example: 'My iPhone 15',
    nullable: true,
  })
  nickname!: string | null;

  @ApiProperty({
    description: 'Credential creation timestamp',
    example: '2026-03-26T10:00:00Z',
  })
  createdAt!: Date;

  /**
   * Convert PasskeyCredential entity to response DTO (excludes publicKey)
   */
  static fromEntity(credential: PasskeyCredential): PasskeyCredentialResponseDto {
    const dto = new PasskeyCredentialResponseDto();
    dto.id = credential.id;
    dto.credentialId = credential.credentialId;
    dto.deviceType = credential.deviceType;
    dto.backedUp = credential.backedUp;
    dto.transports = credential.transports;
    dto.nickname = credential.nickname;
    dto.createdAt = credential.createdAt;
    return dto;
  }
}
