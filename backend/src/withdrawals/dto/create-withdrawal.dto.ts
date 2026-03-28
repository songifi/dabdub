import { IsString, IsNotEmpty, Matches } from 'class-validator';

const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;

export class CreateWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  @Matches(STELLAR_PUBLIC_KEY_REGEX, {
    message: 'toAddress must be a valid Stellar public key (56-char G… address)',
  })
  toAddress!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a positive numeric string' })
  amount!: string;
}
