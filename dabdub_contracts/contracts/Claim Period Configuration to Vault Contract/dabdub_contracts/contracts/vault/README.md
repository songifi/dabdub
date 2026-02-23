# Vault Contract - Claim Period Feature

## Overview

The Vault contract now includes an optional claim window configuration that adds a security layer to payment processing. After a payment is authorized, the beneficiary must claim within a configurable period; otherwise, the payment can be cancelled or reverted.

## Claim Period Configuration

### Storage Keys

- `ClaimPeriodEnabled` (bool): Whether the claim period feature is active
- `ClaimPeriodDuration` (u64): Duration in ledgers (or seconds) for the claim window

### Functions

#### Constructor

```rust
__constructor(
    env: Env,
    admin: Address,
    claim_period_enabled: bool,
    claim_period_duration: u64,
)
```

Initializes the vault with claim period settings.

#### Admin Functions

**set_claim_period**

```rust
set_claim_period(env: Env, enabled: bool, duration: u64)
```

Updates the claim period configuration. Requires admin authorization.

**get_claim_period**

```rust
get_claim_period(env: Env) -> (bool, u64)
```

Returns the current claim period configuration as a tuple (enabled, duration).

## Usage Examples

### Enable Claim Period with 100 Ledgers

```rust
client.set_claim_period(&true, &100);
```

### Disable Claim Period

```rust
client.set_claim_period(&false, &0);
```

### Check Current Configuration

```rust
let (enabled, duration) = client.get_claim_period();
```

## Security Benefits

- Reduces risk of sending funds to stale addresses
- Prevents accidental payments to wrong addresses
- Provides time window for payment verification
- Allows cancellation of unauthorized payments

## Testing

Run the test suite:

```bash
cargo test
```

All unit tests verify:

- Constructor initialization
- Configuration updates
- Default values
- Enable/disable functionality
- Duration-only updates
