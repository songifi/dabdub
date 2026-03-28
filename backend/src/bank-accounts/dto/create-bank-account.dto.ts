import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CreateBankAccountDto {
  @ApiProperty({ example: '058' })
  @IsString()
  @Length(2, 20)
  bankCode!: string;

  @ApiProperty({ example: '0123456789' })
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'accountNumber must be exactly 10 digits',
  })
  accountNumber!: string;
}
