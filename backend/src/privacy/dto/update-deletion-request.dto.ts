import { IsEnum, IsString, MinLength, IsOptional, IsDateString } from 'class-validator';
import { DeletionRequestStatus } from '../enums/deletion-request-status.enum';

export class UpdateDeletionRequestDto {
  @IsEnum(DeletionRequestStatus)
  status: DeletionRequestStatus;

  @IsString()
  @MinLength(20)
  reviewNote: string;

  @IsOptional()
  @IsDateString()
  legalHoldExpiresAt?: string;
}
