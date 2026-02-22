import { IsInt, IsBoolean, IsString, Min, Max, MinLength } from 'class-validator';

export class UpdateRetentionPolicyDto {
  @IsInt()
  @Min(30)
  @Max(3650)
  retentionDays: number;

  @IsBoolean()
  isEnabled: boolean;

  @IsString()
  @MinLength(20)
  legalBasis: string;

  @IsBoolean()
  archiveBeforeDelete: boolean;
}
