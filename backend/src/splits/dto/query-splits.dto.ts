import { IsEnum, IsOptional } from 'class-validator';
import { SplitRequestStatus } from '../entities/split-request.entity';

export enum SplitRole {
  INITIATOR = 'initiator',
  PARTICIPANT = 'participant',
}

export class QuerySplitsDto {
  @IsOptional()
  @IsEnum(SplitRole)
  role?: SplitRole;

  @IsOptional()
  @IsEnum(SplitRequestStatus)
  status?: SplitRequestStatus;
}
