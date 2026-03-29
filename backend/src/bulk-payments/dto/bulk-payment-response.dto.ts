import { BulkPaymentStatus } from '../entities/bulk-payment.entity';

export class BulkPaymentResponseDto {
  id: string;
  label: string;
  totalRows: number;
  successCount: number;
  failureCount: number;
  totalAmountUsdc: string;
  status: BulkPaymentStatus;
  createdAt: Date;
  completedAt: Date | null;
  progress: number; // successCount / totalRows
}

export class BulkPaymentValidationSummaryDto {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  totalAmountUsdc: string;
  errors: string[];
}

export class BulkPaymentUploadResponseDto {
  bulkPayment: BulkPaymentResponseDto;
  validation: BulkPaymentValidationSummaryDto;
}