import { BulkPaymentRowStatus } from '../entities/bulk-payment-row.entity';

export class BulkPaymentRowResponseDto {
  id: string;
  rowNumber: number;
  toUsername: string;
  amountUsdc: string;
  note: string | null;
  status: BulkPaymentRowStatus;
  failureReason: string | null;
  txId: string | null;
  processedAt: Date | null;
}

export class BulkPaymentRowsResponseDto {
  data: BulkPaymentRowResponseDto[];
  nextCursor: string | null;
}