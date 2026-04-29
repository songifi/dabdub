# Soroban Escrow Contract Upgrade Procedure

This document outlines the procedure for upgrading the `PaymentEscrow` contract WASM using the built-in proxy pattern.

## Prerequisites

- Soroban CLI installed.
- Admin credentials (the address stored in `DataKey::Admin`).
- The new contract WASM file.

## Step-by-Step Guide

### 1. Build the New WASM
Ensure the new version of the contract is compiled to WASM.
```bash
cargo build --target wasm32-unknown-unknown --release
```

### 2. Upload the New WASM
Upload the new WASM to the network to get its hash. Note that this doesn't deploy a new contract instance; it only stores the bytecode on-chain.
```bash
soroban contract install --wasm target/wasm32-unknown-unknown/release/payment_escrow.wasm --source <ADMIN_SECRET> --network <NETWORK>
```
The output will be a **WASM Hash** (e.g., `ae34...`).

### 3. Invoke the Upgrade Function
Call the `upgrade` function on the *existing* contract instance using the admin account.

```bash
soroban contract invoke \
  --id <EXISTING_CONTRACT_ID> \
  --source <ADMIN_SECRET> \
  --network <NETWORK> \
  -- \
  upgrade \
  --caller <ADMIN_ADDRESS> \
  --new_wasm_hash <NEW_WASM_HASH>
```

### 4. Verify the Upgrade
After a successful invocation, verify that the contract version has incremented.

```bash
soroban contract invoke \
  --id <EXISTING_CONTRACT_ID> \
  --network <NETWORK> \
  -- \
  get_version
```
The version should now be `2` (or current version + 1).

## Important Considerations

- **Storage Compatibility**: The new WASM must be compatible with the existing storage structure. Adding new fields to `PaymentEscrow` struct or changing `DataKey` variants requires careful migration logic.
- **Admin Restriction**: Only the address stored in the `Admin` key can trigger an upgrade. If this is a multisig address, the transaction must be signed by the required number of participants.
- **State Preservation**: All instance and persistent storage (payments, registry address, etc.) are preserved during the upgrade.

## Migration Logic
If the upgrade requires data migration (e.g., transforming old storage formats to new ones), the `upgrade` function in `lib.rs` should be modified to include the migration logic *before* calling `update_current_contract_wasm`.
