import { ApiProperty } from '@nestjs/swagger';

export class PresignResponseDto {
  @ApiProperty({ example: 'https://s3.example.com/bucket/key?X-Amz-Algorithm=...' })
  url!: string;

  @ApiProperty({ example: 'uploads/kyc/user-id/uuid.png' })
  key!: string;
}
