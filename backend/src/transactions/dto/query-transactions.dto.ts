import { IsOptional, IsArray, IsEnum, IsDateString } from 'class-validator';
import {
  TransactionType,
  TransactionStatus,
} from '../entities/transaction.entity';

export class QueryTransactionsDto {
  @IsOptional()
  @IsArray()
  @IsEnum(TransactionType, { each: true })
  types?: TransactionType[];

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  cursor?: string;
}
