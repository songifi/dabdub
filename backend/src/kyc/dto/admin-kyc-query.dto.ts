import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { KycSubmissionStatus } from '../entities/kyc-submission.entity';
import { TierName } from '../../tier-config/entities/tier-config.entity';

export class AdminKycQueryDto {
  @ApiPropertyOptional({ enum: KycSubmissionStatus })
  @IsOptional()
  @IsEnum(KycSubmissionStatus)
  status?: KycSubmissionStatus;

  @ApiPropertyOptional({ enum: [TierName.GOLD, TierName.BLACK] })
  @IsOptional()
  @IsEnum([TierName.GOLD, TierName.BLACK])
  targetTier?: TierName.GOLD | TierName.BLACK;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
