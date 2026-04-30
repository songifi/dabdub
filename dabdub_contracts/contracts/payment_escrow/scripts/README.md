# Escrow deploy and init scripts

These scripts deploy and initialize the `payment_escrow` contract with Soroban CLI.

## Prerequisites

- `stellar` CLI available in `PATH`
- `cargo` available in `PATH` (used to build wasm if missing)
- Required env vars:
  - `NETWORK` (`testnet` or `mainnet`)
  - `STELLAR_SOURCE_ACCOUNT_SECRET`
  - `ESCROW_ADMIN`
  - `ESCROW_USDC_TOKEN`
  - `ESCROW_DEFAULT_TTL_LEDGERS`
- Optional env vars:
  - `ESCROW_REGISTRY_CONTRACT`
  - `INIT_FN` (defaults to `init`)
  - `SOROBAN_RPC_URL`
  - `STELLAR_NETWORK_PASSPHRASE`

## Deploy and initialize

From repo root:

```bash
NETWORK=testnet \
STELLAR_SOURCE_ACCOUNT_SECRET=S... \
ESCROW_ADMIN=G... \
ESCROW_USDC_TOKEN=C... \
ESCROW_DEFAULT_TTL_LEDGERS=17280 \
bash dabdub_contracts/contracts/payment_escrow/scripts/deploy.sh
```

`deploy.sh` will:

1. Build the escrow wasm if needed.
2. Deploy the contract.
3. Capture the deployed contract ID.
4. Persist contract ID keys in `backend/.env.example`.
5. Call `init.sh` to initialize the contract.

## Rollback procedure

Soroban contracts are immutable; rollback means switching consumers to a prior known-good contract ID.

1. Retrieve the previous contract ID from git history (`backend/.env.example`).
2. Update:
   - `SOROBAN_ESCROW_CONTRACT_ID`
   - `SOROBAN_ESCROW_CONTRACT_ID_TESTNET` or `SOROBAN_ESCROW_CONTRACT_ID_MAINNET`
3. Commit the config change.
4. Redeploy backend/services using the reverted contract ID.
5. Verify read calls and event monitoring point to the reverted contract.
