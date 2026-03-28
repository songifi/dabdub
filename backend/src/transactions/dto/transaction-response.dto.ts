import { Transaction } from '../entities/transaction.entity';

export class TransactionResponseDto {
  id!: string;
  userId!: string;
  type!: string;
  amount!: string;
  fee!: string | null;
  balanceAfter!: string;
  status!: string;
  reference!: string;
  counterpartyUsername!: string | null;
  note!: string | null;
  metadata!: Record<string, unknown>;
  createdAt!: Date;

  static fromEntity(entity: Transaction): TransactionResponseDto {
    const dto = new TransactionResponseDto();
    dto.id = entity.id;
    dto.userId = entity.userId;
    dto.type = entity.type;
    dto.amount = entity.amount;
    dto.fee = entity.fee;
    dto.balanceAfter = entity.balanceAfter;
    dto.status = entity.status;
    dto.reference = entity.reference;
    dto.counterpartyUsername = entity.counterpartyUsername;
    dto.note = entity.note;
    dto.metadata = entity.metadata;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}

export class PaginatedTransactionsDto {
  items!: TransactionResponseDto[];
  nextCursor?: string;
}
