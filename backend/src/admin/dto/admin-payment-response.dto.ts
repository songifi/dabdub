import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transaction } from '../../transactions/entities/transaction.entity';

export class AdminPaymentDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() type!: string;
  @ApiProperty() amountUsdc!: string;
  @ApiProperty() amount!: number;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional() fee!: string | null;
  @ApiProperty() balanceAfter!: string;
  @ApiProperty() status!: string;
  @ApiPropertyOptional() reference!: string | null;
  @ApiPropertyOptional() counterpartyUsername!: string | null;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty() metadata!: Record<string, unknown>;
  @ApiPropertyOptional() depositId!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  /** Stellar.expert transaction explorer link, present when reference looks like a Stellar tx hash */
  @ApiPropertyOptional({ example: 'https://stellar.expert/explorer/testnet/tx/abc123' })
  stellarExpertUrl!: string | null;

  static fromEntity(tx: Transaction, network: 'testnet' | 'mainnet'): AdminPaymentDto {
    const dto = new AdminPaymentDto();
    dto.id = tx.id;
    dto.userId = tx.userId;
    dto.type = tx.type;
    dto.amountUsdc = tx.amountUsdc;
    dto.amount = tx.amount;
    dto.currency = tx.currency;
    dto.fee = tx.fee;
    dto.balanceAfter = tx.balanceAfter;
    dto.status = tx.status;
    dto.reference = tx.reference;
    dto.counterpartyUsername = tx.counterpartyUsername;
    dto.description = tx.description;
    dto.metadata = tx.metadata;
    dto.depositId = tx.depositId;
    dto.createdAt = tx.createdAt;
    dto.updatedAt = tx.updatedAt;
    dto.stellarExpertUrl = tx.reference
      ? `https://stellar.expert/explorer/${network}/tx/${tx.reference}`
      : null;
    return dto;
  }
}

export class PaginatedAdminPaymentsDto {
  @ApiProperty({ type: [AdminPaymentDto] }) data!: AdminPaymentDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
