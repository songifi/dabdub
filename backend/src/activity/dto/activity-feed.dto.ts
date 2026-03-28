import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionStatus, TransactionType } from '../../transactions/entities/transaction.entity';

export class CounterpartyDto {
  @ApiProperty() username!: string;
  @ApiPropertyOptional() displayName!: string | null;
}

export class ActivityFeedItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: TransactionType }) type!: TransactionType;
  @ApiProperty() displayType!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() amountNgn!: string;
  @ApiPropertyOptional() fee!: string | null;
  @ApiProperty({ enum: TransactionStatus }) status!: TransactionStatus;
  @ApiPropertyOptional({ type: CounterpartyDto }) counterparty!: CounterpartyDto | null;
  @ApiPropertyOptional() note!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() icon!: string;
}

export class ActivityFeedDto {
  @ApiProperty({ type: [ActivityFeedItemDto] }) data!: ActivityFeedItemDto[];
  @ApiProperty() limit!: number;
  @ApiProperty() hasMore!: boolean;
  @ApiPropertyOptional() nextCursor?: string;
}

export class ActivitySummaryDto {
  @ApiProperty() totalInflow!: string;
  @ApiProperty() totalOutflow!: string;
  @ApiProperty() transactionCount!: number;
  @ApiProperty() averageTransactionValue!: string;
}

export class MonthlyBreakdownItemDto {
  @ApiProperty() month!: string;
  @ApiProperty() incoming!: string;
  @ApiProperty() outgoing!: string;
}

export class ActivityDetailDto extends ActivityFeedItemDto {
  @ApiPropertyOptional() blockchainTxHash!: string | null;
  @ApiPropertyOptional() reference!: string | null;
  @ApiPropertyOptional() balanceAfter!: string;
  @ApiPropertyOptional() metadata!: Record<string, unknown>;
}
