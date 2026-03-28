# CheesePay Deployments

This document tracks all CheesePay smart contract deployments across different networks.

## Testnet Deployment

### Network Information
- **Network**: Stellar Testnet
- **RPC URL**: `https://soroban-testnet.stellar.org`
- **Network Passphrase**: `Test SDF Network ; September 2015`

### Contract IDs

| Contract | Contract ID | Status |
|----------|-------------|--------|
| PayLink | `TODO` | Deployed |
| CheesePay | `TODO` | Deployed |

### Admin Information
- **Admin Address**: `TODO`
- **Fee Treasury Address**: `TODO`
- **USDC SAC Address**: `TODO`

### Configuration
- **Fee Rate**: 50 bps (0.5%)
- **Treasury Username**: `treasury`

### Deployment Date
- **Last Deployment**: YYYY-MM-DD

---

## Mainnet Deployment

### Network Information
- **Network**: Stellar Public Network
- **RPC URL**: `https://soroban-rpc.stellar.org:443`
- **Network Passphrase**: `Public Global Stellar Network ; September 2015`

### Contract IDs

| Contract | Contract ID | Status |
|----------|-------------|--------|
| PayLink | `TODO` | Not Deployed |
| CheesePay | `TODO` | Not Deployed |

### Admin Information
- **Admin Address**: `TODO`
- **Fee Treasury Address**: `TODO`
- **USDC SAC Address**: `TODO`

### Configuration
- **Fee Rate**: 50 bps (0.5%)
- **Treasury Username**: `treasury`

### Deployment Date
- **Last Deployment**: Not deployed

---

## Deployment Instructions

### Prerequisites

1. **Rust + wasm target**
   ```bash
   rustup target add wasm32v1-none
   ```

2. **Stellar CLI (v25.2.0)**
   ```bash
   cargo install --locked stellar-cli
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Fill in ADMIN_SECRET_KEY and USDC_SAC_ADDRESS
   ```

### Deploy to Testnet

1. **Fund the admin account**
   - Extract the admin public key from your secret key
   - Fund it using the [Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test)
   - Minimum recommended balance: 10 XLM

2. **Run the deployment script**
   ```bash
   ./scripts/deploy.sh
   ```

3. **Register the treasury user**
   ```bash
   export CHEESE_PAY_CONTRACT_ID=<contract_id_from_deploy_output>
   ./scripts/register_treasury.sh
   ```

4. **Update this document**
   - Copy the contract IDs from the deployment output
   - Update the Admin Address
   - Update the USDC SAC Address
   - Record the deployment date

### Deploy to Mainnet

⚠️ **WARNING**: Mainnet deployment should only be performed after thorough testing on testnet.

1. **Update .env for mainnet**
   ```bash
   STELLAR_RPC_URL=https://soroban-rpc.stellar.org:443
   STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
   ```

2. **Ensure admin account is funded with sufficient XLM**
   - Minimum recommended balance: 100 XLM

3. **Run the deployment script**
   ```bash
   ./scripts/deploy.sh
   ```

4. **Register the treasury user**
   ```bash
   export CHEESE_PAY_CONTRACT_ID=<contract_id_from_deploy_output>
   ./scripts/register_treasury.sh
   ```

---

## Verification

### Verify Contract Installation

```bash
# Verify paylink contract
stellar contract info \
  --id <PAYLINK_CONTRACT_ID> \
  --network testnet

# Verify cheese_pay contract
stellar contract info \
  --id <CHEESE_PAY_CONTRACT_ID> \
  --network testnet
```

### Verify Initialization

```bash
# Check paylink admin
stellar contract invoke \
  --id <PAYLINK_CONTRACT_ID> \
  --network testnet \
  -- \
  get_admin

# Check cheese_pay configuration
stellar contract invoke \
  --id <CHEESE_PAY_CONTRACT_ID> \
  --network testnet \
  -- \
  get_fee_rate_bps
```

---

## Upgrade Procedure

To upgrade a deployed contract:

1. **Build the new version**
   ```bash
   cargo wasm-build --manifest-path contracts/cheese_pay/Cargo.toml
   ```

2. **Upload new WASM**
   ```bash
   stellar contract upload \
     --source admin \
     --network testnet \
     --wasm contracts/cheese_pay/target/wasm32v1-none/release/cheese_pay.wasm
   ```

3. **Update the contract instance**
   ```bash
   stellar contract update \
     --source admin \
     --network testnet \
     --id <CHEESE_PAY_CONTRACT_ID> \
     --new-wasm-hash <hash_from_upload>
   ```

---

## Troubleshooting

### Common Issues

**"Account not found"**
- Fund the admin account using the Stellar Laboratory

**"Insufficient balance"**
- Ensure the admin account has at least 10 XLM for testnet deployments

**"Transaction failed"**
- Check the RPC URL and network passphrase
- Verify the admin key is correct

**"Contract not initialized"**
- Run the initialize function after deployment
- Check that all required parameters are provided

### Getting Help

- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://soroban.stellar.org/)
- [Stellar Discord](https://discord.gg/stellardev)

---

## Security Notes

⚠️ **IMPORTANT**: Never commit secret keys to version control!

- Store production secret keys in a secure vault
- Use separate keys for testnet and mainnet
- Rotate keys periodically
- Monitor admin account activity

---

## Change Log

| Date | Version | Network | Changes |
|------|---------|---------|---------|
| YYYY-MM-DD | 0.1.0 | Testnet | Initial deployment |
