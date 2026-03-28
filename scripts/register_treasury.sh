#!/bin/bash
set -euo pipefail

# Register Treasury User Script
# This script calls register_user for the fee treasury account on the CheesePay contract

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

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Load environment variables
load_env() {
    log_info "Loading environment variables..."
    
    if [[ ! -f .env ]]; then
        log_error ".env file not found. Copy .env.example to .env and fill in the values."
        exit 1
    fi
    
    # Source .env file
    set -a
    source .env
    set +a
    
    # Validate required variables
    if [[ -z "$ADMIN_SECRET_KEY" ]]; then
        log_error "ADMIN_SECRET_KEY is not set in .env"
        exit 1
    fi
    
    if [[ -z "$CHEESE_PAY_CONTRACT_ID" ]]; then
        log_error "CHEESE_PAY_CONTRACT_ID is not set in .env"
        exit 1
    fi
    
    log_success "Environment variables loaded"
}

# Setup identity
setup_identity() {
    log_info "Setting up admin identity..."
    
    # Check if admin key exists
    if ! stellar keys address --key admin &>/dev/null; then
        log_info "Adding admin key to stellar-cli..."
        stellar keys add admin --secret-key "$ADMIN_SECRET_KEY" --network testnet
    fi
    
    ADMIN_PUBLIC_KEY=$(stellar keys address --key admin)
    log_success "Admin identity: $ADMIN_PUBLIC_KEY"
}

# Register treasury user
register_treasury() {
    log_info "Registering treasury user on CheesePay contract..."
    
    # Use admin address as treasury username for simplicity
    # In production, you might want a custom username
    TREASURY_USERNAME=${TREASURY_USERNAME:-"treasury"}
    
    log_info "Registering username: $TREASURY_USERNAME"
    log_info "Treasury address: $ADMIN_PUBLIC_KEY"
    
    stellar contract invoke \
        --source admin \
        --network testnet \
        --id "$CHEESE_PAY_CONTRACT_ID" \
        -- \
        register_user \
        --username "$TREASURY_USERNAME" \
        --address "$ADMIN_PUBLIC_KEY"
    
    log_success "Treasury user registered successfully!"
    
    echo ""
    echo "========================================"
    echo -e "${GREEN}Treasury Registration Complete${NC}"
    echo "========================================"
    echo ""
    echo -e "${BLUE}Contract ID:${NC} $CHEESE_PAY_CONTRACT_ID"
    echo -e "${BLUE}Treasury Username:${NC} $TREASURY_USERNAME"
    echo -e "${BLUE}Treasury Address:${NC} $ADMIN_PUBLIC_KEY"
    echo ""
    echo "The treasury can now receive fees and participate in the CheesePay ecosystem."
    echo "========================================"
}

# Main execution
main() {
    echo ""
    echo "========================================"
    echo -e "${BLUE}CheesePay Treasury Registration${NC}"
    echo "========================================"
    echo ""
    
    load_env
    setup_identity
    register_treasury
}

# Run main function
main "$@"
