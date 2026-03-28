import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class ResetPinDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^[0-9]{6}$/, { message: 'otpCode must be a 6-digit code' })
  otpCode!: string;

  @ApiProperty({ example: '5678' })
  @Matches(/^[0-9]{4}$/, { message: 'newPin must be exactly 4 digits' })
  newPin!: string;
}
