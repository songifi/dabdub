import { IsOptional, IsBoolean, IsInt, IsDecimal, Min } from "class-validator";

export class UpdateTokenConfigDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsDecimal()
  minimumAcceptedAmount?: string;

  @IsOptional()
  @IsDecimal()
  maximumAcceptedAmount?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
