import { IsEnum, IsString, IsOptional, IsNotEmpty } from 'class-validator';
import {
  TransactionType,
  TransactionStatus,
} from '../entities/transaction.entity';

export class CreateTransactionDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;

  @IsNotEmpty()
  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsNotEmpty()
  @IsString()
  amount!: string;

  @IsOptional()
  @IsString()
  fee?: string;

  @IsNotEmpty()
  @IsString()
  balanceAfter!: string;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsNotEmpty()
  @IsString()
  reference!: string;

  @IsOptional()
  @IsString()
  counterpartyUsername?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
