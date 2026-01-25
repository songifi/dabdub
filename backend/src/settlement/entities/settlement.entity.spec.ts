import {
  Settlement,
  SettlementStatus,
  SettlementProvider,
} from './settlement.entity';

describe('Settlement Entity', () => {
  describe('SettlementStatus enum', () => {
    it('should have all required status values', () => {
      expect(SettlementStatus.PENDING).toBe('pending');
      expect(SettlementStatus.PROCESSING).toBe('processing');
      expect(SettlementStatus.COMPLETED).toBe('completed');
      expect(SettlementStatus.FAILED).toBe('failed');
    });
  });

  describe('SettlementProvider enum', () => {
    it('should have all required provider values', () => {
      expect(SettlementProvider.STRIPE).toBe('stripe');
      expect(SettlementProvider.BANK_API).toBe('bank_api');
      expect(SettlementProvider.WISE).toBe('wise');
      expect(SettlementProvider.PAYPAL).toBe('paypal');
      expect(SettlementProvider.OTHER).toBe('other');
    });
  });

  describe('Settlement entity structure', () => {
    it('should create a settlement with all required fields', () => {
      const settlement = new Settlement();
      settlement.paymentRequestId = '123e4567-e89b-12d3-a456-426614174001';
      settlement.merchantId = '123e4567-e89b-12d3-a456-426614174002';
      settlement.amount = 1000.5;
      settlement.currency = 'USD';
      settlement.status = SettlementStatus.PENDING;
      settlement.feeAmount = 10.0;
      settlement.netAmount = 990.5;
      settlement.retryCount = 0;
      settlement.maxRetries = 3;

      expect(settlement.paymentRequestId).toBe(
        '123e4567-e89b-12d3-a456-426614174001',
      );
      expect(settlement.merchantId).toBe(
        '123e4567-e89b-12d3-a456-426614174002',
      );
      expect(settlement.amount).toBe(1000.5);
      expect(settlement.currency).toBe('USD');
      expect(settlement.status).toBe(SettlementStatus.PENDING);
      expect(settlement.feeAmount).toBe(10.0);
      expect(settlement.netAmount).toBe(990.5);
      expect(settlement.retryCount).toBe(0);
      expect(settlement.maxRetries).toBe(3);
    });

    it('should handle optional fields', () => {
      const settlement = new Settlement();
      settlement.paymentRequestId = '123e4567-e89b-12d3-a456-426614174001';
      settlement.merchantId = '123e4567-e89b-12d3-a456-426614174002';
      settlement.amount = 1000.5;
      settlement.currency = 'USD';
      settlement.netAmount = 990.5;
      settlement.bankAccountNumber = '1234567890';
      settlement.bankName = 'Test Bank';
      settlement.provider = SettlementProvider.STRIPE;
      settlement.metadata = { customField: 'value' };

      expect(settlement.bankAccountNumber).toBe('1234567890');
      expect(settlement.bankName).toBe('Test Bank');
      expect(settlement.provider).toBe(SettlementProvider.STRIPE);
      expect(settlement.metadata).toEqual({ customField: 'value' });
    });

    it('should have default values', () => {
      const settlement = new Settlement();
      settlement.paymentRequestId = '123e4567-e89b-12d3-a456-426614174001';
      settlement.merchantId = '123e4567-e89b-12d3-a456-426614174002';
      settlement.amount = 1000.5;
      settlement.currency = 'USD';
      settlement.netAmount = 990.5;

      // Status should default to PENDING
      expect(settlement.status).toBeUndefined(); // Will be set by DB default
      // Fee amount should default to 0
      expect(settlement.feeAmount).toBeUndefined(); // Will be set by DB default
      // Retry count should default to 0
      expect(settlement.retryCount).toBeUndefined(); // Will be set by DB default
      // Max retries should default to 3
      expect(settlement.maxRetries).toBeUndefined(); // Will be set by DB default
    });
  });
});
