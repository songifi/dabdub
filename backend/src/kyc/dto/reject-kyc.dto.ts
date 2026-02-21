import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { KycRejectionReason } from '../enums';

export class RejectKycDto {
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  reviewNote: string;

  @IsEnum(KycRejectionReason)
  rejectionReason: KycRejectionReason;
}
