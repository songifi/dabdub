# Blockchain Configuration Admin

Admin interface for managing supported blockchain networks and tokens. Changes take effect within 30 seconds through cache invalidation.

## Features

- **Chain Management**: Add, update, and manage blockchain networks
- **Token Configuration**: Create and manage token configurations per chain
- **On-Chain Verification**: Automatic verification of token contracts on-chain
- **Encryption**: RPC URLs encrypted at rest
- **Audit Logging**: Complete audit trail of all configuration changes
- **Event Publishing**: Real-time event notifications for config changes
- **Cache Invalidation**: 30-second TTL for configuration propagation
- **Node Health Monitoring**: Real-time RPC node status checks

## Project Structure

```
src/
├── config/
│   ├── controllers/
│   │   ├── blockchain-config.controller.ts
│   │   └── token-config.controller.ts
│   ├── dtos/
│   │   ├── create-token-config.dto.ts
│   │   ├── update-chain-config.dto.ts
│   │   └── update-token-config.dto.ts
│   ├── entities/
│   │   ├── audit-log.entity.ts
│   │   ├── blockchain-config.entity.ts
│   │   └── token-config.entity.ts
│   ├── services/
│   │   ├── audit.service.ts
│   │   ├── blockchain-config.service.ts
│   │   ├── cache.service.ts
│   │   ├── encryption.service.ts
│   │   ├── event.service.ts
│   │   ├── rpc.service.ts
│   │   └── token-config.service.ts
│   └── config.module.ts
├── app.module.ts
├── config.ts
└── main.ts
```

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=blockchain_config
DB_SSL=false

# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# JWT
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=24h

# Cache
CACHE_TTL=300000

# RPC
RPC_TIMEOUT=5000
RPC_MAX_RETRIES=3
```

## API Endpoints

### Chain Configuration

#### Get All Chains

```
GET /api/v1/config/chains
```

Returns list of all chain configurations with real-time node status.

#### Get Chain by ID

```
GET /api/v1/config/chains/:chainId
```

Returns specific chain configuration with node health status.

#### Update Chain Config

```
PATCH /api/v1/config/chains/:chainId
```

**Request Body:**

```json
{
  "isEnabled": true,
  "requiredConfirmations": 12,
  "pollingIntervalSeconds": 30,
  "maxGasLimitGwei": "100.00",
  "fallbackRpcUrl": "https://backup-rpc.example.com"
}
```

**Validation:**

- If disabling chain: checks for pending transactions
- If changing requiredConfirmations: logs security warning
- Cache invalidated immediately (30s propagation)

### Token Configuration

#### Get All Tokens

```
GET /api/v1/config/tokens?chainId=base&isEnabled=true&symbol=USDC
```

Query Parameters:

- `chainId` (optional): Filter by chain ID
- `isEnabled` (optional): Filter by enabled status (true/false)
- `symbol` (optional): Filter by token symbol

#### Create Token

```
POST /api/v1/config/tokens
```

**Request Body:**

```json
{
  "chainId": "base",
  "tokenAddress": "0xd9aAEc86B65D86f6A7B630E7ee24B0ebA4e6Dedf",
  "symbol": "USDC",
  "name": "USD Coin",
  "decimals": 6,
  "minimumAcceptedAmount": "0.01",
  "maximumAcceptedAmount": "1000000.00",
  "coingeckoId": "usd-coin"
}
```

**Validation:**

- Chain must exist
- Token contract verified on-chain
- Token symbol and decimals validated
- Created with isEnabled = false (must be explicitly enabled)

#### Update Token

```
PATCH /api/v1/config/tokens/:id
```

**Request Body:**

```json
{
  "isEnabled": true,
  "minimumAcceptedAmount": "0.05",
  "maximumAcceptedAmount": "500000.00",
  "sortOrder": 1
}
```

#### Disable Token

```
DELETE /api/v1/config/tokens/:id
```

Soft-disables the token (sets isEnabled = false). Only allowed if no pending transactions exist.

## Services

### BlockchainConfigService

Manages blockchain network configurations including RPC endpoints, gas limits, and confirmation requirements.

### TokenConfigService

Manages token configurations per chain with on-chain verification and validation.

### AuditService

Logs all configuration changes with full audit trail including user, timestamp, and change details.

### CacheService

Manages caching with pattern-based invalidation and 30-second TTL for chain configs.

### EventService

Publishes real-time events for configuration changes:

- `chain.config.updated`: Triggered when chain config changes
- `token.added`: Triggered when new token is added
- `token.updated`: Triggered when token is updated
- `token.disabled`: Triggered when token is disabled

### EncryptionService

Encrypts/decrypts sensitive data (RPC URLs) using AES-256-CBC.

### RpcService

Verifies tokens on-chain and checks node health status.

## Running the Application

### Development

```bash
npm run start:dev
```

### Production

```bash
npm run build
npm run start:prod
```

## Testing

```bash
npm run test
npm run test:watch
npm run test:cov
```

## Audit Trail

All changes are automatically logged to the `audit_logs` table with:

- Action type (CHAIN_CONFIG_UPDATED, TOKEN_ADDED, etc.)
- Entity type and ID
- Full diff of changes (old/new values)
- User ID and IP address
- Timestamp

## Cache Invalidation

Configuration changes invalidate cache immediately and propagate within 30 seconds:

- Chain config: 30-second TTL
- Token config: Default TTL
- Automatic pattern-based invalidation

## Security Considerations

1. **RPC URL Encryption**: All RPC URLs encrypted at rest using AES-256-CBC
2. **Audit Logging**: Complete audit trail for compliance
3. **Validation**: On-chain verification of token contracts
4. **Security Warnings**: Logged when sensitive settings change
5. **Transactional Safety**: Cannot disable chains/tokens with pending transactions

## License

UNLICENSED
