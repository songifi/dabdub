# Vault Contract Events Documentation

## Overview

This document describes the event definitions for the claim period feature in the Vault contract. These events enable comprehensive tracking and monitoring of the claim lifecycle, allowing off-chain systems (frontend and backend) to react to claim state changes.

## Event Definitions

### 1. ClaimCreatedEvent

Emitted when a new claim is created with a claim period.

**Topics:** `["VAULT", "claim_created"]`

**Fields:**

- `payment_id: BytesN<32>` - Unique identifier for the payment
- `user_wallet: Address` - Address of the user who initiated the payment
- `recipient: Address` - Address of the recipient who can claim the payment
- `payment_amount: i128` - Amount to be paid to the recipient
- `fee_amount: i128` - Fee amount charged for the transaction
- `expiry_ledger: u32` - Ledger number when the claim expires

**When Emitted:**

- When a user creates a payment with a claim period
- Before the claim is stored in contract storage

**Use Cases:**

- Frontend: Display pending claims to recipients
- Backend: Track claim creation for analytics
- Monitoring: Alert on new claims created

**Example:**

```rust
env.events().publish(
    (symbol_short!("VAULT"), symbol_short!("claim_created")),
    ClaimCreatedEvent {
        payment_id,
        user_wallet,
        recipient,
        payment_amount: 1000,
        fee_amount: 50,
        expiry_ledger: 12345,
    },
);
```

---

### 2. ClaimCompletedEvent

Emitted when a recipient successfully claims their payment within the claim period.

**Topics:** `["VAULT", "claim_completed"]`

**Fields:**

- `payment_id: BytesN<32>` - Unique identifier for the payment
- `recipient: Address` - Address of the recipient who claimed the payment
- `total_amount: i128` - Total amount claimed (payment + any additional amounts)

**When Emitted:**

- When a recipient successfully claims a payment
- After funds are transferred to the recipient
- Before the claim is removed from storage

**Use Cases:**

- Frontend: Update UI to show claim as completed
- Backend: Record successful claim for accounting
- Notifications: Send confirmation to user and recipient

**Example:**

```rust
env.events().publish(
    (symbol_short!("VAULT"), symbol_short!("claim_completed")),
    ClaimCompletedEvent {
        payment_id,
        recipient,
        total_amount: 1050,
    },
);
```

---

### 3. ClaimCancelledEvent

Emitted when a claim is cancelled for any reason.

**Topics:** `["VAULT", "claim_cancelled"]`

**Fields:**

- `payment_id: BytesN<32>` - Unique identifier for the payment
- `reason: Symbol` - Reason for cancellation

**Common Reasons:**

- `"expired"` - Claim period expired without being claimed
- `"user_cancel"` - User manually cancelled the claim
- `"insufficient"` - Insufficient funds to complete claim
- `"error"` - Generic error during claim processing

**When Emitted:**

- When a claim expires without being claimed
- When a user manually cancels a pending claim
- When a claim fails due to an error condition
- Before funds are returned to the user (if applicable)

**Use Cases:**

- Frontend: Update UI to show claim as cancelled
- Backend: Track cancellation reasons for analytics
- Notifications: Alert user about cancellation
- Refunds: Trigger refund process if needed

**Example:**

```rust
env.events().publish(
    (symbol_short!("VAULT"), symbol_short!("claim_cancelled")),
    ClaimCancelledEvent {
        payment_id,
        reason: symbol_short!("expired"),
    },
);
```

---

### 4. PaymentProcessedEvent (Updated)

Updated version of the existing PaymentProcessedEvent to indicate whether a payment has a pending claim period.

**Topics:** `["VAULT", "payment_processed"]`

**Fields:**

- `payment_id: BytesN<32>` - Unique identifier for the payment
- `user_wallet: Address` - Address of the user who initiated the payment
- `recipient: Address` - Address of the recipient
- `amount: i128` - Total amount processed
- `claim_pending: bool` - **NEW:** Whether this payment has a pending claim period

**When Emitted:**

- When any payment is processed through the vault
- Regardless of whether it has a claim period or not

**Use Cases:**

- Frontend: Differentiate between instant and claim-based payments
- Backend: Track payment types for reporting
- Analytics: Measure adoption of claim period feature

**Example:**

```rust
env.events().publish(
    (symbol_short!("VAULT"), symbol_short!("payment_processed")),
    PaymentProcessedEvent {
        payment_id,
        user_wallet,
        recipient,
        amount: 1000,
        claim_pending: true, // Indicates this payment has a claim period
    },
);
```

---

## Event Flow Diagrams

### Successful Claim Flow

```
1. PaymentProcessedEvent (claim_pending: true)
   ↓
2. ClaimCreatedEvent
   ↓
3. [Recipient claims within period]
   ↓
4. ClaimCompletedEvent
```

### Expired Claim Flow

```
1. PaymentProcessedEvent (claim_pending: true)
   ↓
2. ClaimCreatedEvent
   ↓
3. [Claim period expires]
   ↓
4. ClaimCancelledEvent (reason: "expired")
```

### User Cancelled Claim Flow

```
1. PaymentProcessedEvent (claim_pending: true)
   ↓
2. ClaimCreatedEvent
   ↓
3. [User cancels claim]
   ↓
4. ClaimCancelledEvent (reason: "user_cancel")
```

---

## Integration Guidelines

### Frontend Integration

**Listening for Events:**

```typescript
// Subscribe to claim events
const claimCreatedEvents = await contract
  .events()
  .filter((e) => e.topics.includes("claim_created"))
  .subscribe();

// Handle claim created
claimCreatedEvents.on("data", (event) => {
  const { payment_id, recipient, expiry_ledger } = event.data;
  // Update UI to show pending claim
  showPendingClaim(payment_id, recipient, expiry_ledger);
});
```

**Tracking Claim Status:**

```typescript
// Track claim lifecycle
const claimStatus = {
  created: false,
  completed: false,
  cancelled: false,
};

// Listen for all claim events for a specific payment_id
contract
  .events()
  .filter((e) => e.data.payment_id === targetPaymentId)
  .subscribe((event) => {
    if (event.topics.includes("claim_created")) {
      claimStatus.created = true;
    } else if (event.topics.includes("claim_completed")) {
      claimStatus.completed = true;
    } else if (event.topics.includes("claim_cancelled")) {
      claimStatus.cancelled = true;
    }
    updateUI(claimStatus);
  });
```

### Backend Integration

**Event Indexing:**

```rust
// Index events for analytics
match event.topics {
    ["VAULT", "claim_created"] => {
        let data: ClaimCreatedEvent = event.parse_data()?;
        db.insert_claim(data.payment_id, ClaimStatus::Pending)?;
    }
    ["VAULT", "claim_completed"] => {
        let data: ClaimCompletedEvent = event.parse_data()?;
        db.update_claim(data.payment_id, ClaimStatus::Completed)?;
    }
    ["VAULT", "claim_cancelled"] => {
        let data: ClaimCancelledEvent = event.parse_data()?;
        db.update_claim(data.payment_id, ClaimStatus::Cancelled)?;
    }
    _ => {}
}
```

---

## Testing Events

### Unit Tests

All events include unit tests that verify:

- Events are emitted correctly
- Event data contains expected values
- Events can be captured and parsed

**Run tests:**

```bash
cargo test
```

### Test Snapshots

Test snapshots capture event emissions for verification:

```rust
#[test]
fn test_claim_lifecycle_events() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VaultContract);
    let client = VaultContractClient::new(&env, &contract_id);

    // Create claim
    client.create_claim(/* ... */);

    // Complete claim
    client.complete_claim(/* ... */);

    // Verify events
    let events = env.events().all();
    assert_eq!(events.len(), 2); // Created + Completed

    // Verify event types
    assert!(events[0].topics.contains(&symbol_short!("claim_created")));
    assert!(events[1].topics.contains(&symbol_short!("claim_completed")));
}
```

---

## Event Conventions

All events in this contract follow these conventions:

1. **Topic Structure:** `["VAULT", "<event_name>"]`
   - First topic: Contract identifier
   - Second topic: Specific event name

2. **Naming:** PascalCase with "Event" suffix
   - Example: `ClaimCreatedEvent`, `ClaimCompletedEvent`

3. **Documentation:** Each event includes:
   - Purpose description
   - Field documentation
   - Usage examples
   - Integration guidelines

4. **Data Types:**
   - Use `BytesN<32>` for identifiers
   - Use `Address` for wallet addresses
   - Use `i128` for amounts (Stellar standard)
   - Use `Symbol` for categorical data (reasons, statuses)

---

## Monitoring and Alerts

### Recommended Monitoring

1. **Claim Creation Rate**
   - Track `ClaimCreatedEvent` frequency
   - Alert on unusual spikes or drops

2. **Claim Completion Rate**
   - Ratio of `ClaimCompletedEvent` to `ClaimCreatedEvent`
   - Alert if completion rate drops below threshold

3. **Cancellation Reasons**
   - Track `ClaimCancelledEvent` reasons
   - Alert on high "error" cancellations

4. **Expiry Rate**
   - Track claims cancelled due to "expired"
   - May indicate UX issues if too high

### Example Monitoring Query

```sql
-- Track claim completion rate
SELECT
  DATE(timestamp) as date,
  COUNT(CASE WHEN event_type = 'claim_created' THEN 1 END) as created,
  COUNT(CASE WHEN event_type = 'claim_completed' THEN 1 END) as completed,
  COUNT(CASE WHEN event_type = 'claim_cancelled' THEN 1 END) as cancelled,
  (COUNT(CASE WHEN event_type = 'claim_completed' THEN 1 END) * 100.0 /
   COUNT(CASE WHEN event_type = 'claim_created' THEN 1 END)) as completion_rate
FROM vault_events
WHERE event_type IN ('claim_created', 'claim_completed', 'claim_cancelled')
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

---

## Version History

- **v1.0.0** - Initial event definitions
  - Added `ClaimCreatedEvent`
  - Added `ClaimCompletedEvent`
  - Added `ClaimCancelledEvent`
  - Updated `PaymentProcessedEvent` with `claim_pending` field
