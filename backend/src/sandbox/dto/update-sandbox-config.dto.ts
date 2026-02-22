import { IsBoolean, IsDecimal, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateSandboxConfigDto {
  @IsOptional()
  @IsBoolean()
  autoConfirmTransactions?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  simulatedConfirmationDelay?: number;

  @IsOptional()
  @IsBoolean()
  simulateRandomFailures?: boolean;

  @IsOptional()
  @IsDecimal()
  failureRate?: string;
}
