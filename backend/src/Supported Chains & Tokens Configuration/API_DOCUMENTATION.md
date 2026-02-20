# NestJS Blockchain Configuration Admin - API Documentation

## Overview

This is a production-ready NestJS application for managing blockchain network configurations and token settings. The system supports rapid configuration updates with automatic cache invalidation and comprehensive audit logging.

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### Installation & Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your database credentials and encryption key

# Run database migrations (auto-sync in development)
npm run start:dev
```

### Development Server

```bash
npm run start:dev
```

Server runs on `http://localhost:3000`

### Production Build

```bash
npm run build
npm run start:prod
```

## API Reference

### Authentication

All endpoints support JWT authentication via `Authorization: Bearer <token>` header.
User ID and IP address are automatically extracted from the request for audit logging.

---

## Chain Configuration Endpoints

### 1. List All Chains

**Endpoint:** `GET /api/v1/config/chains`

**Query Parameters:** None

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1",
      "chainId": "base",
      "displayName": "Base Mainnet",
      "rpcUrl": "https://mainnet.base.org",
      "fallbackRpcUrl": "https://backup.example.com",
      "explorerUrl": "https://basescan.org",
      "requiredConfirmations": 12,
      "isEnabled": true,
      "isTestnet": false,
      "chainIdNumeric": 8453,
      "maxGasLimitGwei": "100.00",
      "pollingIntervalSeconds": 30,
      "metadata": null,
      "nodeStatus": {
        "healthy": true,
        "fallbackHealthy": true
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

**Cache:** 30-second TTL

---

### 2. Get Chain by ID

**Endpoint:** `GET /api/v1/config/chains/:chainId`

**Parameters:**

- `chainId` (path): The chain identifier (e.g., 'base', 'ethereum', 'polygon')

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-1",
    "chainId": "base",
    "displayName": "Base Mainnet",
    "rpcUrl": "https://mainnet.base.org",
    "fallbackRpcUrl": null,
    "explorerUrl": "https://basescan.org",
    "requiredConfirmations": 12,
    "isEnabled": true,
    "isTestnet": false,
    "chainIdNumeric": 8453,
    "maxGasLimitGwei": "100.00",
    "pollingIntervalSeconds": 30,
    "metadata": null,
    "nodeStatus": {
      "healthy": true,
      "fallbackHealthy": null
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Chain config not found for ethereum",
  "statusCode": 404
}
```

---

### 3. Update Chain Configuration

**Endpoint:** `PATCH /api/v1/config/chains/:chainId`

**Parameters:**

- `chainId` (path): The chain identifier

**Request Body:**

```json
{
  "isEnabled": true,
  "requiredConfirmations": 12,
  "pollingIntervalSeconds": 30,
  "maxGasLimitGwei": "150.50",
  "fallbackRpcUrl": "https://backup-rpc.example.com"
}
```

**Validation Rules:**

- `isEnabled`: boolean (optional)
  - Disabling a chain checks for pending transactions
- `requiredConfirmations`: integer, range 1-100 (optional)
  - Changes logged as security warning
- `pollingIntervalSeconds`: integer, range 5-300 (optional)
- `maxGasLimitGwei`: decimal string (optional)
- `fallbackRpcUrl`: valid URL (optional)

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-1",
    "chainId": "base",
    "displayName": "Base Mainnet",
    "requiredConfirmations": 12,
    "isEnabled": true,
    "maxGasLimitGwei": "150.50",
    "pollingIntervalSeconds": 30,
    "updatedAt": "2024-01-15T11:45:00Z"
  },
  "message": "Chain config updated for base"
}
```

**Side Effects:**

1. Security warning logged if requiredConfirmations changes
2. `chain.config.updated` event published
3. Cache invalidated (30s propagation)
4. Audit log created with full diff

**Error Cases:**

```json
{
  "success": false,
  "error": "Cannot disable chain with pending transactions. Please wait for transactions to complete.",
  "statusCode": 400
}
```

---

## Token Configuration Endpoints

### 4. List All Tokens

**Endpoint:** `GET /api/v1/config/tokens`

**Query Parameters:**

- `chainId` (optional): Filter by chain ID (e.g., 'base')
- `isEnabled` (optional): Filter by enabled status ('true' or 'false')
- `symbol` (optional): Filter by token symbol (case-insensitive, partial match)

**Examples:**

```
GET /api/v1/config/tokens
GET /api/v1/config/tokens?chainId=base
GET /api/v1/config/tokens?chainId=base&isEnabled=true
GET /api/v1/config/tokens?symbol=USDC
GET /api/v1/config/tokens?chainId=ethereum&isEnabled=true&symbol=usdc
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-2",
      "chainId": "base",
      "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "isEnabled": true,
      "isNative": false,
      "minimumAcceptedAmount": "0.01",
      "maximumAcceptedAmount": "1000000.00",
      "coingeckoId": "usd-coin",
      "sortOrder": 0,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "uuid-3",
      "chainId": "base",
      "tokenAddress": "native",
      "symbol": "ETH",
      "name": "Ethereum",
      "decimals": 18,
      "isEnabled": true,
      "isNative": true,
      "minimumAcceptedAmount": "0.001",
      "maximumAcceptedAmount": null,
      "coingeckoId": "ethereum",
      "sortOrder": 1,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 2
}
```

---

### 5. Create New Token

**Endpoint:** `POST /api/v1/config/tokens`

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

**For Native Tokens:**

```json
{
  "chainId": "base",
  "tokenAddress": "native",
  "symbol": "ETH",
  "name": "Ethereum",
  "decimals": 18,
  "minimumAcceptedAmount": "0.001"
}
```

**Validation Rules:**

- `chainId`: string, required
  - Must exist in blockchain_configs
- `tokenAddress`: string, required
  - Must be valid Ethereum address (0x...) or 'native'
- `symbol`: string, 1-10 characters, required
- `name`: string, 1-100 characters, required
- `decimals`: integer, 0-18, required
- `minimumAcceptedAmount`: decimal string, required
- `maximumAcceptedAmount`: decimal string (optional)
- `coingeckoId`: string (optional)

**Validation Process:**

1. Chain exists in database
2. Token address + chain uniqueness check
3. On-chain verification (calls token contract for symbol & decimals)
4. Symbol and decimals must match contract values

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "uuid-4",
    "chainId": "base",
    "tokenAddress": "0xd9aAEc86B65D86f6A7B630E7ee24B0ebA4e6Dedf",
    "symbol": "USDC",
    "name": "USD Coin",
    "decimals": 6,
    "isEnabled": false,
    "isNative": false,
    "minimumAcceptedAmount": "0.01",
    "maximumAcceptedAmount": "1000000.00",
    "coingeckoId": "usd-coin",
    "sortOrder": 0,
    "createdAt": "2024-01-15T12:00:00Z",
    "updatedAt": "2024-01-15T12:00:00Z"
  },
  "message": "Token USDC added successfully (disabled by default)"
}
```

**Error Cases:**

```json
{
  "success": false,
  "error": "Blockchain config not found for chain invalid-chain",
  "statusCode": 400
}
```

```json
{
  "success": false,
  "error": "Token already exists for base:0xd9aAEc86B65D86f6A7B630E7ee24B0ebA4e6Dedf",
  "statusCode": 409
}
```

```json
{
  "success": false,
  "error": "Token verification failed for 0xd9aAEc86B65D86f6A7B630E7ee24B0ebA4e6Dedf. Symbol or decimals mismatch.",
  "statusCode": 400
}
```

**Side Effects:**

1. `token.added` event published
2. Audit log created
3. Token cache invalidated

**Important Notes:**

- **New tokens are created with `isEnabled = false`**
- Token must be explicitly enabled via PATCH endpoint
- On-chain verification prevents misconfiguration

---

### 6. Update Token Configuration

**Endpoint:** `PATCH /api/v1/config/tokens/:id`

**Parameters:**

- `id` (path): Token UUID

**Request Body:**

```json
{
  "isEnabled": true,
  "minimumAcceptedAmount": "0.05",
  "maximumAcceptedAmount": "500000.00",
  "sortOrder": 1
}
```

**Validation Rules:**

- `isEnabled`: boolean (optional)
- `minimumAcceptedAmount`: decimal string (optional)
- `maximumAcceptedAmount`: decimal string (optional)
- `sortOrder`: integer >= 0 (optional)

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid-4",
    "chainId": "base",
    "tokenAddress": "0xd9aAEc86B65D86f6A7B630E7ee24B0ebA4e6Dedf",
    "symbol": "USDC",
    "name": "USD Coin",
    "decimals": 6,
    "isEnabled": true,
    "minimumAcceptedAmount": "0.05",
    "maximumAcceptedAmount": "500000.00",
    "sortOrder": 1,
    "updatedAt": "2024-01-15T12:30:00Z"
  },
  "message": "Token updated successfully"
}
```

**Side Effects:**

1. `token.updated` event published
2. Audit log created with change details
3. Token and chain token caches invalidated

---

### 7. Disable Token

**Endpoint:** `DELETE /api/v1/config/tokens/:id`

**Parameters:**

- `id` (path): Token UUID

**Response:**

```json
{
  "success": true,
  "message": "Token disabled successfully"
}
```

**Validation:**

- Checks for pending transactions for this token
- Only soft-disables (sets isEnabled = false, doesn't delete)

**Error Case:**

```json
{
  "success": false,
  "error": "Cannot delete token with pending transactions. Please wait for transactions to complete.",
  "statusCode": 400
}
```

**Side Effects:**

1. Token `isEnabled` set to `false`
2. `token.disabled` event published
3. Audit log created
4. Cache invalidated

---

## Events

The system publishes events that can be consumed by other services:

### chain.config.updated

```typescript
{
  chainId: string;
  changes: Record<string, any>; // New values
  timestamp: Date;
}
```

### token.added

```typescript
{
  tokenId: string;
  chainId: string;
  tokenAddress: string;
  timestamp: Date;
}
```

### token.updated

```typescript
{
  tokenId: string;
  changes: Record<string, any>; // New values
  timestamp: Date;
}
```

### token.disabled

```typescript
{
  tokenId: string;
  chainId: string;
  symbol: string;
  timestamp: Date;
}
```

---

## Audit Trail

Every modification is logged with:

- Action type
- Entity type and ID
- Full diff (old/new values)
- User ID
- IP address
- Timestamp

**Query Audit Logs** (via database):

```sql
SELECT * FROM audit_logs
WHERE entityType = 'blockchain_config'
  AND action = 'CHAIN_CONFIG_UPDATED'
ORDER BY createdAt DESC
LIMIT 100;
```

---

## Cache Behavior

### TTLs

- Chain configurations: **30 seconds** (fast propagation)
- Token configurations: Default TTL
- Chain list: 30 seconds

### Invalidation Strategy

- Immediate invalidation on changes
- Pattern-based invalidation for related keys
- 30-second automatic expiration

### Cache Keys

- `chain:{chainId}` - Individual chain config
- `chains:all` - All chains
- `tokens:{chainId}` - Tokens for specific chain
- `tokens:all` - All tokens
- `token:{id}` - Individual token

---

## Security Features

### Encryption

- RPC URLs encrypted at rest using AES-256-CBC
- Encryption key from environment variable
- Automatic encryption/decryption in service layer

### Validation

- On-chain token contract verification
- Unique constraints enforced (chainId, tokenAddress)
- Input validation with class-validator

### Audit Logging

- All changes logged with user context
- IP address captured for each change
- Full diff tracking for compliance

### Safety Checks

- Cannot disable chains with pending transactions
- Cannot delete tokens with pending transactions
- Security warnings for critical changes

---

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": "Descriptive error message",
  "statusCode": 400
}
```

### HTTP Status Codes

- `200 OK`: Successful GET/PATCH
- `201 Created`: Successful POST
- `400 Bad Request`: Validation failure or business logic error
- `404 Not Found`: Resource not found
- `409 Conflict`: Uniqueness violation
- `500 Internal Server Error`: Unexpected error

---

## Rate Limiting & Performance

### Recommendations

- Consider implementing rate limiting per API key
- Monitor database query performance
- Consider read replicas for heavily queried endpoints
- Implement circuit breakers for RPC calls

### Caching Impact

With 30-second chain config TTL:

- 90%+ cache hit rate expected
- Sub-millisecond responses for cached data
- Automatic refresh on configuration changes

---

## Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov
```

---

## Deployment

### Environment Checklist

- [ ] Encryption key set (32+ characters)
- [ ] JWT secret configured
- [ ] Database credentials set
- [ ] CORS origins configured
- [ ] RPC endpoints configured
- [ ] Log level appropriate for environment

### Health Check

```bash
curl http://localhost:3000/api/v1/config/chains
```

Expected: 200 OK with chain list

---

## Support & Troubleshooting

### Common Issues

**Token verification fails:**

- Verify RPC endpoint is accessible
- Check token contract address on-chain
- Ensure symbol and decimals match contract

**Cache not invalidating:**

- Verify Redis/cache manager connection
- Check cache service logs
- Monitor cache keys in storage

**Audit logs missing:**

- Verify PostgreSQL audit_logs table exists
- Check database connection logs
- Ensure user context is available in requests
