import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength, IsNumberString, Min } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({ example: 'alice' })
  @IsString()
  @IsNotEmpty()
  toUsername!: string;

  @ApiProperty({ example: '10.00', description: 'Amount in USDC' })
  @IsNumberString()
  amount!: string;

  @ApiProperty({ example: 'Thanks for lunch', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  note?: string;
}
