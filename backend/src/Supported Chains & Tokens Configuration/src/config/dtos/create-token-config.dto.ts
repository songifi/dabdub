import {
  IsString,
  IsInt,
  Min,
  Max,
  IsDecimal,
  IsOptional,
  Length,
  Matches,
} from "class-validator";

export class CreateTokenConfigDto {
  @IsString()
  chainId: string;

  @IsString()
  @Matches(/^(0x[a-fA-F0-9]{40}|native)$/, {
    message: 'tokenAddress must be a valid Ethereum address or "native"',
  })
  tokenAddress: string; // or 'native'

  @IsString()
  @Length(1, 10)
  symbol: string;

  @IsString()
  @Length(1, 100)
  name: string;

  @IsInt()
  @Min(0)
  @Max(18)
  decimals: number;

  @IsDecimal()
  minimumAcceptedAmount: string;

  @IsOptional()
  @IsDecimal()
  maximumAcceptedAmount?: string;

  @IsOptional()
  @IsString()
  coingeckoId?: string;
}
