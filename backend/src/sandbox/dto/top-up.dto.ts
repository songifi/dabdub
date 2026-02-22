import { IsDecimal, IsString } from 'class-validator';

export class TopUpDto {
  @IsDecimal()
  amount: string;

  @IsString()
  tokenSymbol: string;
}
