# Settlement Entity and Repository

This module implements the Settlement entity and repository for tracking fiat settlements and bank transfers to merchants.

## Overview

The Settlement entity tracks the complete lifecycle of fiat transfers from crypto payments, including:
- Settlement status tracking (pending, processing, completed, failed)
- Bank transfer details
- Fee calculation and tracking
- Exchange rate tracking
- Settlement batching support
- Retry logic for failed settlements
- Provider integration (Stripe, bank API, Wise, PayPal, etc.)

## Entity Structure

### Core Fields
- `id`: UUID primary key
- `paymentRequestId`: Unique reference to the payment request (one-to-one relationship)
- `merchantId`: Reference to the merchant (many-to-one relationship)
- `amount`: Settlement amount (decimal, precision 19, scale 4)
- `currency`: Settlement currency (3-character code)
- `status`: Settlement status enum (pending, processing, completed, failed)

### Bank Transfer Details
- `bankAccountNumber`: Bank account number
- `bankRoutingNumber`: Bank routing number
- `bankName`: Bank name
- `bankAccountHolderName`: Account holder name
- `bankSwiftCode`: SWIFT/BIC code
- `bankIban`: IBAN code

### Settlement Batching
- `batchId`: UUID for batch grouping
- `batchSequence`: Sequence number within batch

### Fee Tracking
- `feeAmount`: Fee amount in settlement currency
- `feePercentage`: Fee percentage (if applicable)
- `netAmount`: Net amount after fees

### Exchange Rate
- `exchangeRate`: Exchange rate at settlement time
- `sourceCurrency`: Source currency (e.g., USDC)

### Provider Integration
- `provider`: Settlement provider enum (stripe, bank_api, wise, paypal, other)
- `providerReference`: Provider's reference number
- `settlementReceipt`: Settlement receipt number (unique)
- `settlementReference`: Internal settlement reference

### Failure Handling
- `failureReason`: Text description of failure
- `retryCount`: Current retry attempt count
- `maxRetries`: Maximum retry attempts (default: 3)

### Timestamps
- `settledAt`: When settlement was completed
- `processedAt`: When settlement processing started
- `createdAt`: Record creation timestamp
- `updatedAt`: Record update timestamp

### Metadata
- `metadata`: JSONB field for additional metadata

## Database Indexes

The following indexes are created for optimal query performance:
- `IDX_SETTLEMENTS_STATUS`: Index on status field
- `IDX_SETTLEMENTS_MERCHANT_ID`: Index on merchant_id field
- `IDX_SETTLEMENTS_SETTLED_AT`: Index on settled_at field
- `IDX_SETTLEMENTS_PAYMENT_REQUEST_ID`: Unique index on payment_request_id
- `IDX_SETTLEMENTS_BATCH_ID`: Index on batch_id field

## Repository Methods

### Basic CRUD
- `create(settlementData)`: Create a new settlement
- `findOne(id)`: Find settlement by ID
- `update(id, updateData)`: Update settlement
- `delete(id)`: Delete settlement

### Query Methods
- `findByPaymentRequestId(paymentRequestId)`: Find by payment request ID
- `findByMerchantId(merchantId, options?)`: Find all settlements for a merchant
- `findByStatus(status, options?)`: Find settlements by status
- `findByBatchId(batchId)`: Find all settlements in a batch
- `findByMerchantAndStatus(merchantId, status, options?)`: Find by merchant and status

### Specialized Queries
- `findPendingSettlements(limit?)`: Find pending settlements ready for processing
- `findRetryableSettlements(limit?)`: Find failed settlements that can be retried
- `findWithPagination(options)`: Find with pagination support
- `count(where?)`: Count settlements matching criteria

### Status Management
- `updateStatus(id, status, additionalData?)`: Update settlement status atomically
  - Automatically sets `settledAt` when status is COMPLETED
  - Automatically sets `processedAt` when status is PROCESSING
- `incrementRetryCount(id)`: Increment retry count for failed settlements

### Statistics
- `getSettlementStats(merchantId?)`: Get settlement statistics
  - Returns: total, pending, processing, completed, failed counts
  - Returns: totalAmount, totalFees

## Usage Example

```typescript
import { SettlementRepository } from './repositories/settlement.repository';
import { SettlementStatus, SettlementProvider } from './entities/settlement.entity';

// Create a settlement
const settlement = await settlementRepository.create({
  paymentRequestId: 'payment-request-uuid',
  merchantId: 'merchant-uuid',
  amount: 1000.50,
  currency: 'USD',
  netAmount: 990.50,
  feeAmount: 10.00,
  feePercentage: 0.01,
  provider: SettlementProvider.STRIPE,
  bankAccountNumber: '1234567890',
  bankName: 'Test Bank',
  exchangeRate: 1.0,
  sourceCurrency: 'USDC',
});

// Update status
await settlementRepository.updateStatus(
  settlement.id,
  SettlementStatus.PROCESSING,
);

// Find pending settlements
const pendingSettlements = await settlementRepository.findPendingSettlements(10);

// Get statistics
const stats = await settlementRepository.getSettlementStats('merchant-uuid');
```

## Migration

The migration file `1735689600000-CreateSettlementsTable.ts` creates:
1. PostgreSQL enum types for status and provider
2. The settlements table with all columns
3. All required indexes
4. Unique constraints

To run the migration:
```bash
npm run typeorm migration:run
```

To revert the migration:
```bash
npm run typeorm migration:revert
```

## Testing

Unit tests are provided for:
- Settlement entity structure and enums
- Repository methods (create, find, update, status management)

Run tests with:
```bash
npm test
```

## Acceptance Criteria Validation

✅ **Settlements track complete fiat transfer lifecycle**
- All required fields are present
- Status enum covers all lifecycle states
- Timestamps track key events

✅ **Settlement batching works correctly**
- Batch ID and sequence fields are present
- Repository methods support batch queries

✅ **Fees are accurately calculated and recorded**
- Fee amount and percentage fields
- Net amount calculation
- Statistics include fee totals

✅ **Settlement status updates are atomic**
- `updateStatus` method ensures atomic updates
- Automatic timestamp management
- Retry count tracking

## Future Enhancements

When PaymentRequest and Merchant entities are created:
1. Uncomment relationship decorators in the entity
2. Uncomment foreign key constraints in the migration
3. Add cascade delete behavior
