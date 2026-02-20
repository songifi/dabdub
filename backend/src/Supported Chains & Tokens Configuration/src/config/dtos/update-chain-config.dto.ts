import {
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsDecimal,
  IsUrl,
} from "class-validator";

export class UpdateChainConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  requiredConfirmations?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(300)
  pollingIntervalSeconds?: number;

  @IsOptional()
  @IsDecimal()
  maxGasLimitGwei?: string;

  @IsOptional()
  @IsUrl()
  fallbackRpcUrl?: string;
}
