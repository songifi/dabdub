import { IsString, IsEnum, IsObject, IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { ContractEventType } from '../entities/contract-event-log.entity';

export class ContractEventDto {
  @IsString()
  id!: string;

  @IsString()
  txHash!: string;

  @IsNumber()
  eventIndex!: number;

  @IsEnum(ContractEventType)
  eventType!: ContractEventType;

  @IsObject()
  data!: Record<string, unknown>;

  @IsNumber()
  ledger!: number;

  @IsString()
  processedAt!: string;
}

export class ReconciliationAlertDto {
  @IsString()
  id!: string;

  @IsString()
  userId!: string;

  @IsString()
  discrepancyType!: string;

  @IsString()
  message!: string;

  @IsObject()
  data!: Record<string, unknown>;

  @IsBoolean()
  isResolved!: boolean;

  @IsOptional()
  @IsString()
  resolvedNote?: string;

  @IsString()
  createdAt!: string;
}

export class PaginatedContractEventsDto {
  data!: ContractEventDto[];
  limit!: number;
  total!: number;
  page!: number;
  hasMore!: boolean;
}

export class PaginatedReconciliationAlertsDto {
  data!: ReconciliationAlertDto[];
  limit!: number;
  total!: number;
  page!: number;
  hasMore!: boolean;
}
