import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshDto {
  @ApiProperty({ example: 'dGhpcyBpcyBhIHJlZnJlc2g...', description: 'Opaque refresh token from a previous login or refresh' })
  @IsString()
  refreshToken!: string;
}
