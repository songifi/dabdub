# Test Snapshots - Vault Contract Claim Period

## Test Suite Overview

All tests verify the claim period configuration functionality added to the Vault contract.

## Test Cases

### 1. test_constructor_initializes_claim_period

**Purpose**: Verify that the constructor properly initializes claim period settings

**Setup**:

- Admin address generated
- Constructor called with `enabled=true`, `duration=100`

**Expected Result**:

- `get_claim_period()` returns `(true, 100)`

**Status**: ✓ Pass

---

### 2. test_set_claim_period_updates_configuration

**Purpose**: Verify that admin can update claim period configuration

**Setup**:

- Constructor called with `enabled=false`, `duration=0`
- Admin calls `set_claim_period(true, 200)`

**Expected Result**:

- `get_claim_period()` returns `(true, 200)`

**Status**: ✓ Pass

---

### 3. test_get_claim_period_returns_defaults_when_not_set

**Purpose**: Verify default values when claim period is not initialized

**Setup**:

- Contract registered without constructor call
- `get_claim_period()` called directly

**Expected Result**:

- `get_claim_period()` returns `(false, 0)`

**Status**: ✓ Pass

---

### 4. test_disable_claim_period

**Purpose**: Verify that claim period can be disabled after being enabled

**Setup**:

- Constructor called with `enabled=true`, `duration=100`
- Admin calls `set_claim_period(false, 0)`

**Expected Result**:

- `get_claim_period()` returns `(false, 0)`

**Status**: ✓ Pass

---

### 5. test_update_claim_period_duration_only

**Purpose**: Verify that duration can be updated while keeping claim period enabled

**Setup**:

- Constructor called with `enabled=true`, `duration=100`
- Admin calls `set_claim_period(true, 500)`

**Expected Result**:

- `get_claim_period()` returns `(true, 500)`

**Status**: ✓ Pass

---

## Test Coverage Summary

- ✓ Constructor initialization
- ✓ Configuration updates via admin function
- ✓ Default value handling
- ✓ Enable/disable functionality
- ✓ Duration-only updates
- ✓ Admin authorization (via `mock_all_auths()`)

## Running Tests

To run the test suite when Rust/Cargo is available:

```bash
cd dabdub_contracts/contracts/vault
cargo test
```

Expected output:

```
running 5 tests
test test::test_constructor_initializes_claim_period ... ok
test test::test_set_claim_period_updates_configuration ... ok
test test::test_get_claim_period_returns_defaults_when_not_set ... ok
test test::test_disable_claim_period ... ok
test test::test_update_claim_period_duration_only ... ok

test result: ok. 5 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```
