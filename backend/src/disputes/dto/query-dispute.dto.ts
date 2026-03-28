import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { DisputeStatus, DisputeType } from '../entities/dispute.entity';

export class QueryDisputesDto {
  @IsOptional()
  @IsEnum(DisputeStatus)
  status?: DisputeStatus;

  @IsOptional()
  @IsEnum(DisputeType)
  type?: DisputeType;
}

export class RejectDisputeDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  resolution?: string;
}
