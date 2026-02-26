/**
 * Partner Liquidity API Interface
 * 
 * Interface for integrating with partner liquidity providers
 * to convert USDC to fiat currency and initiate bank transfers.
 */

export interface ConversionRequest {
  sourceAmount: number;
  sourceCurrency: string; // e.g., 'USDC'
  targetCurrency: string; // e.g., 'USD', 'NGN', 'EUR'
  merchantId: string;
  paymentRequestId: string;
}

export interface ConversionResult {
  success: boolean;
  conversionId?: string;
  sourceAmount: number;
  targetAmount: number;
  exchangeRate: number;
  fee: number;
  timestamp: Date;
  error?: string;
}

export interface BankTransferRequest {
  conversionId: string;
  amount: number;
  currency: string;
  recipient: {
    accountNumber: string;
    routingNumber?: string;
    swiftCode?: string;
    iban?: string;
    accountHolderName: string;
    bankName: string;
  };
  reference: string;
  merchantId: string;
}

export interface BankTransferResult {
  success: boolean;
  transferId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimatedCompletionTime?: Date;
  error?: string;
}

export interface SettlementStatusResult {
  transferId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: Date;
  failureReason?: string;
  bankReference?: string;
}

export interface IPartnerLiquidityApi {
  /**
   * Convert USDC to fiat currency
   */
  convertToFiat(request: ConversionRequest): Promise<ConversionResult>;

  /**
   * Initiate bank transfer to merchant account
   */
  initiateBankTransfer(request: BankTransferRequest): Promise<BankTransferResult>;

  /**
   * Check settlement status
   */
  getSettlementStatus(transferId: string): Promise<SettlementStatusResult>;

  /**
   * Get current exchange rate
   */
  getExchangeRate(from: string, to: string): Promise<number>;
}

// Legacy interface for backward compatibility
export interface TransferResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface IPartnerService {
  executeTransfer(
    amount: number,
    currency: string,
    recipient: {
      accountNumber: string;
      routingNumber: string;
      name: string;
    },
  ): Promise<TransferResult>;

  getExchangeRate(from: string, to: string): Promise<number>;
}
