#!/usr/bin/env bash
set -euo pipefail

NETWORK="${NETWORK:-testnet}"
INIT_FN="${INIT_FN:-init}"
CONTRACT_ID="${CONTRACT_ID:-${ESCROW_CONTRACT_ID:-}}"

case "$NETWORK" in
  testnet)
    RPC_URL="${SOROBAN_RPC_URL:-https://soroban-testnet.stellar.org}"
    NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Test SDF Network ; September 2015}"
    ;;
  mainnet)
    RPC_URL="${SOROBAN_RPC_URL:-https://mainnet.sorobanrpc.com}"
    NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-Public Global Stellar Network ; September 2015}"
    ;;
  *)
    echo "Unsupported NETWORK: ${NETWORK}. Use testnet or mainnet." >&2
    exit 1
    ;;
esac

if [[ -z "${CONTRACT_ID}" ]]; then
  echo "Missing CONTRACT_ID (or ESCROW_CONTRACT_ID)." >&2
  exit 1
fi

if [[ -z "${STELLAR_SOURCE_ACCOUNT_SECRET:-}" ]]; then
  echo "Missing STELLAR_SOURCE_ACCOUNT_SECRET." >&2
  exit 1
fi

if [[ -z "${ESCROW_ADMIN:-}" || -z "${ESCROW_USDC_TOKEN:-}" || -z "${ESCROW_DEFAULT_TTL_LEDGERS:-}" ]]; then
  echo "Missing one or more required init args: ESCROW_ADMIN, ESCROW_USDC_TOKEN, ESCROW_DEFAULT_TTL_LEDGERS." >&2
  exit 1
fi

INIT_CMD=(
  stellar contract invoke
  --id "${CONTRACT_ID}"
  --source-account "${STELLAR_SOURCE_ACCOUNT_SECRET}"
  --rpc-url "${RPC_URL}"
  --network-passphrase "${NETWORK_PASSPHRASE}"
  --fn "${INIT_FN}"
  --admin "${ESCROW_ADMIN}"
  --usdc_token "${ESCROW_USDC_TOKEN}"
  --default_ttl_ledgers "${ESCROW_DEFAULT_TTL_LEDGERS}"
)

if [[ -n "${ESCROW_REGISTRY_CONTRACT:-}" ]]; then
  INIT_CMD+=(--registry "${ESCROW_REGISTRY_CONTRACT}")
fi

echo "Initializing escrow contract ${CONTRACT_ID} on ${NETWORK} (fn=${INIT_FN})..."
"${INIT_CMD[@]}"
echo "Initialization complete."
