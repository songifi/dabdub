import { IsUUID, IsString, IsDecimal, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';

export enum SimulatedOutcome {
  SUCCESS = 'SUCCESS',
  FAIL_INSUFFICIENT_CONFIRMATIONS = 'FAIL_INSUFFICIENT_CONFIRMATIONS',
  FAIL_DOUBLE_SPEND = 'FAIL_DOUBLE_SPEND',
  FAIL_NETWORK_ERROR = 'FAIL_NETWORK_ERROR',
}

export class SimulateTransactionDto {
  @IsUUID()
  merchantId: string;

  @IsString()
  chain: string;

  @IsDecimal()
  amount: string;

  @IsString()
  tokenSymbol: string;

  @IsEnum(SimulatedOutcome)
  outcome: SimulatedOutcome;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  delaySeconds?: number;
}
