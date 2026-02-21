import { IsString, MaxLength, MinLength } from 'class-validator';

export class ApproveKycDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reviewNote: string;
}
