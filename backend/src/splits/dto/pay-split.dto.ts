import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches } from 'class-validator';

export class PaySplitDto {
  @ApiProperty({ example: '1234' })
  @IsNotEmpty()
  @Matches(/^[0-9]{4}$/)
  pin!: string;
}
