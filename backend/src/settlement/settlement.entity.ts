// backend/src/modules/settlement/settlement.entity.ts
export enum SettlementStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  SETTLED = 'settled',
  FAILED = 'failed'
}

export interface Settlement {
  id: string;
  merchantId: string;
  userId: string;
  usdcAmount: string; // varchar for precision
  ngnAmount: string;
  rate: string;
  bankAccountId: string;
  status: SettlementStatus;
  providerRef?: string;
  failureReason?: string;
  settledAt?: Date;
}
