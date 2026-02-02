export enum TransactionType {
  DEPOSIT = 'deposit',
  SETTLEMENT = 'settlement',
  REFUND = 'refund',
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REPLACED = 'replaced',
}