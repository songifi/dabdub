#!/bin/bash
set -euo pipefail

# CheesePay Smart Contract Deployment Script for Stellar Testnet
# This script builds WASM artifacts, uploads contracts, deploys instances,
# and initializes them with the provided configuration.

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v cargo &> /dev/null; then
        log_error "cargo is not installed. Please install Rust."
        exit 1
    fi
    
    if ! command -v stellar &> /dev/null; then
        log_error "stellar-cli is not installed. Install with: cargo install --locked stellar-cli"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Load environment variables
load_env() {
    log_info "Loading environment variables..."
    
    if [[ ! -f .env ]]; then
        log_error ".env file not found. Copy .env.example to .env and fill in the values."
        exit 1
    fi
    
    export STELLAR_RPC_URL
    export STELLAR_NETWORK_PASSPHRASE
    export ADMIN_SECRET_KEY
    export USDC_SAC_ADDRESS
    
    # Source .env file
    set -a
    source .env
    set +a
    
    # Validate required variables
    if [[ -z "$ADMIN_SECRET_KEY" ]]; then
        log_error "ADMIN_SECRET_KEY is not set in .env"
        exit 1
    fi
    
    if [[ -z "$USDC_SAC_ADDRESS" ]]; then
        log_error "USDC_SAC_ADDRESS is not set in .env"
        exit 1
    fi
    
    log_success "Environment variables loaded"
}

# Build WASM artifacts
build_wasm() {
    log_info "Building WASM artifacts..."
    
    # Build paylink contract
    log_info "Building paylink contract..."
    cargo wasm-build --manifest-path contracts/paylink/Cargo.toml
    
    # Build cheese_pay contract
    log_info "Building cheese_pay contract..."
    cargo wasm-build --manifest-path contracts/cheese_pay/Cargo.toml
    
    log_success "WASM artifacts built successfully"
}

# Get or create admin identity
setup_identity() {
    log_info "Setting up admin identity..."
    
    # Extract public key from secret key
    ADMIN_PUBLIC_KEY=$(stellar keys address --secret-key "$ADMIN_SECRET_KEY" 2>/dev/null || echo "")
    
    if [[ -z "$ADMIN_PUBLIC_KEY" ]]; then
        log_warn "Admin key not found in stellar-cli. Adding from secret key..."
        stellar keys add admin --secret-key "$ADMIN_SECRET_KEY" --network testnet
        ADMIN_PUBLIC_KEY=$(stellar keys address --key admin)
    fi
    
    log_success "Admin identity configured: $ADMIN_PUBLIC_KEY"
    
    # Check balance
    BALANCE=$(stellar balance --source admin 2>/dev/null || echo "0")
    log_info "Admin balance: $BALANCE XLM"
    
    if (( $(echo "$BALANCE < 1" | bc -l 2>/dev/null || echo "1") )); then
        log_warn "Admin balance is low. Please fund the account: $ADMIN_PUBLIC_KEY"
        log_info "You can fund it using the Stellar Laboratory: https://laboratory.stellar.org/#account-creator?network=test"
    fi
}

# Upload contracts to testnet
upload_contracts() {
    log_info "Uploading contracts to testnet..."
    
    # Upload paylink contract
    log_info "Uploading paylink contract..."
    PAYLINK_HASH=$(stellar contract upload \
        --source admin \
        --network testnet \
        --wasm contracts/paylink/target/wasm32v1-none/release/paylink.wasm \
        2>&1 | grep -oP '(?<=hash: )[a-f0-9]+' || true)
    
    if [[ -z "$PAYLINK_HASH" ]]; then
        log_error "Failed to upload paylink contract"
        exit 1
    fi
    
    log_success "Paylink contract uploaded: $PAYLINK_HASH"
    
    # Upload cheese_pay contract
    log_info "Uploading cheese_pay contract..."
    CHEESE_PAY_HASH=$(stellar contract upload \
        --source admin \
        --network testnet \
        --wasm contracts/cheese_pay/target/wasm32v1-none/release/cheese_pay.wasm \
        2>&1 | grep -oP '(?<=hash: )[a-f0-9]+' || true)
    
    if [[ -z "$CHEESE_PAY_HASH" ]]; then
        log_error "Failed to upload cheese_pay contract"
        exit 1
    fi
    
    log_success "Cheese_pay contract uploaded: $CHEESE_PAY_HASH"
    
    # Store hashes for later use
    export PAYLINK_HASH
    export CHEESE_PAY_HASH
}

# Deploy contract instances
deploy_instances() {
    log_info "Deploying contract instances..."
    
    # Deploy paylink contract
    log_info "Deploying paylink instance..."
    PAYLINK_ID=$(stellar contract deploy \
        --source admin \
        --network testnet \
        --wasm-hash "$PAYLINK_HASH" \
        2>&1 | grep -oP '(?<=contract: )[A-Z0-9]+' || true)
    
    if [[ -z "$PAYLINK_ID" ]]; then
        log_error "Failed to deploy paylink instance"
        exit 1
    fi
    
    log_success "Paylink contract deployed: $PAYLINK_ID"
    
    # Deploy cheese_pay contract
    log_info "Deploying cheese_pay instance..."
    CHEESE_PAY_ID=$(stellar contract deploy \
        --source admin \
        --network testnet \
        --wasm-hash "$CHEESE_PAY_HASH" \
        2>&1 | grep -oP '(?<=contract: )[A-Z0-9]+' || true)
    
    if [[ -z "$CHEESE_PAY_ID" ]]; then
        log_error "Failed to deploy cheese_pay instance"
        exit 1
    fi
    
    log_success "Cheese_pay contract deployed: $CHEESE_PAY_ID"
    
    # Store IDs for later use
    export PAYLINK_ID
    export CHEESE_PAY_ID
}

# Initialize contracts
initialize_contracts() {
    log_info "Initializing contracts..."
    
    # Fee rate: 50 bps = 0.5%
    FEE_RATE_BPS=${FEE_RATE_BPS:-50}
    
    # Initialize paylink contract
    log_info "Initializing paylink contract..."
    stellar contract invoke \
        --source admin \
        --network testnet \
        --id "$PAYLINK_ID" \
        -- \
        set_admin \
        --admin "$ADMIN_PUBLIC_KEY"
    
    log_success "Paylink contract initialized"
    
    # Initialize cheese_pay contract
    log_info "Initializing cheese_pay contract..."
    stellar contract invoke \
        --source admin \
        --network testnet \
        --id "$CHEESE_PAY_ID" \
        -- \
        initialize \
        --admin "$ADMIN_PUBLIC_KEY" \
        --usdc_token "$USDC_SAC_ADDRESS" \
        --fee_rate_bps "$FEE_RATE_BPS" \
        --fee_treasury "$ADMIN_PUBLIC_KEY"
    
    log_success "Cheese_pay contract initialized"
}

# Print deployment summary
print_summary() {
    echo ""
    echo "========================================"
    echo -e "${GREEN}Deployment Complete!${NC}"
    echo "========================================"
    echo ""
    echo -e "${BLUE}Network:${NC} Stellar Testnet"
    echo -e "${BLUE}Admin Address:${NC} $ADMIN_PUBLIC_KEY"
    echo ""
    echo -e "${YELLOW}Contract IDs:${NC}"
    echo -e "  PayLink:     ${GREEN}$PAYLINK_ID${NC}"
    echo -e "  CheesePay:   ${GREEN}$CHEESE_PAY_ID${NC}"
    echo ""
    echo -e "${YELLOW}Contract Hashes:${NC}"
    echo -e "  PayLink:     $PAYLINK_HASH"
    echo -e "  CheesePay:   $CHEESE_PAY_HASH"
    echo ""
    echo -e "${YELLOW}Configuration:${NC}"
    echo -e "  Fee Rate:    $FEE_RATE_BPS bps ($(echo "scale=2; $FEE_RATE_BPS / 100" | bc)%)"
    echo -e "  USDC SAC:    $USDC_SAC_ADDRESS"
    echo ""
    echo "========================================"
    echo ""
    log_info "Save these values to DEPLOYMENTS.md"
    log_info "To register the treasury user, run: ./scripts/register_treasury.sh"
}

# Main execution
main() {
    echo ""
    echo "========================================"
    echo -e "${BLUE}CheesePay Contract Deployment${NC}"
    echo "========================================"
    echo ""
    
    check_prerequisites
    load_env
    setup_identity
    build_wasm
    upload_contracts
    deploy_instances
    initialize_contracts
    print_summary
}

# Run main function
main "$@"
