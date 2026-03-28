import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class ChangePinDto {
  @ApiProperty({ example: '1234' })
  @Matches(/^[0-9]{4}$/, { message: 'currentPin must be exactly 4 digits' })
  currentPin!: string;

  @ApiProperty({ example: '5678' })
  @Matches(/^[0-9]{4}$/, { message: 'newPin must be exactly 4 digits' })
  newPin!: string;
}
