export interface PaymentExpiryJobPayload {
  paymentRequestId: string;
  merchantId: string;
  expiresAt: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}
