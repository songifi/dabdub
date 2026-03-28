export enum DepositStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    FAILED = 'failed'
  }
  
  export interface Deposit {
    id: string;
    userId: string;
    txHash: string; // Unique for Idempotency
    amount: string; // In stroops (varchar)
    assetCode: string; // Default: USDC
    network: string; // Default: stellar
    status: DepositStatus;
    failureReason?: string;
    confirmedAt?: Date;
    createdAt: Date;
  }
  