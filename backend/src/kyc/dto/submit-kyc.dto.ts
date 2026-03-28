import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, Length, IsOptional, Matches } from 'class-validator';
import { TierName } from '../../tier-config/entities/tier-config.entity';
import { KycDocumentType } from '../entities/kyc-submission.entity';

export class SubmitKycDto {
  @ApiProperty({ enum: [TierName.GOLD, TierName.BLACK] })
  @IsEnum([TierName.GOLD, TierName.BLACK])
  targetTier!: TierName.GOLD | TierName.BLACK;

  @ApiProperty({ description: 'Last 4 digits of BVN', example: '1234' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'bvnLast4 must be exactly 4 digits' })
  bvnLast4!: string;

  @ApiProperty({ description: 'Last 4 digits of NIN', example: '5678' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'ninLast4 must be exactly 4 digits' })
  ninLast4!: string;

  @ApiProperty({ enum: KycDocumentType })
  @IsEnum(KycDocumentType)
  documentType!: KycDocumentType;

  @ApiProperty({ description: 'R2 key for document front' })
  @IsString()
  @Length(1, 512)
  documentFrontKey!: string;

  @ApiPropertyOptional({ description: 'R2 key for document back (optional)' })
  @IsOptional()
  @IsString()
  @Length(1, 512)
  documentBackKey?: string;

  @ApiProperty({ description: 'R2 key for selfie' })
  @IsString()
  @Length(1, 512)
  selfieKey!: string;
}
