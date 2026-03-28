import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class SetPinDto {
  @ApiProperty({ example: '1234', pattern: '^[0-9]{4}$' })
  @Matches(/^[0-9]{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin!: string;
}
