import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmUploadDto {
  @ApiProperty({ example: 'uploads/kyc/user-id/uuid.png' })
  @IsString()
  key!: string;
}
