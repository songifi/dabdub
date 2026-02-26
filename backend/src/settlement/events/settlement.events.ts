/**
 * Settlement Events
 * 
 * Events emitted during the automated settlement lifecycle:
 * - payment.confirmed: Triggered when a deposit is confirmed on blockchain
 * - payment.settling: Triggered when settlement process starts
 * - payment.settled: Triggered when fiat settlement is completed
 * - payment.failed: Triggered when settlement fails
 */

export interface PaymentConfirmedEvent {
  paymentRequestId: string;
  merchantId: string;
  txHash: string;
  amount: number;
  currency: string;
  network: string;
  confirmedAt: Date;
  usdValue: number;
}

export interface PaymentSettlingEvent {
  paymentRequestId: string;
  merchantId: string;
  settlementId: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  startedAt: Date;
}

export interface PaymentSettledEvent {
  paymentRequestId: string;
  merchantId: string;
  settlementId: string;
  txHash: string;
  amount: number;
  currency: string;
  settledAt: Date;
  settlementReference: string;
}

export interface PaymentFailedEvent {
  paymentRequestId: string;
  merchantId: string;
  settlementId?: string;
  reason: string;
  failedAt: Date;
  retryable: boolean;
}

export const SETTLEMENT_EVENTS = {
  PAYMENT_CONFIRMED: 'payment.confirmed',
  PAYMENT_SETTLING: 'payment.settling',
  PAYMENT_SETTLED: 'payment.settled',
  PAYMENT_FAILED: 'payment.failed',
} as const;
