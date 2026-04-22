import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiJ9...', description: 'Short-lived JWT access token' })
  accessToken!: string;

  @ApiProperty({ example: 'dGhpcyBpcyBhIHJlZnJlc2g...', description: 'Long-lived opaque refresh token' })
  refreshToken!: string;

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' })
  expiresIn!: number;
}
