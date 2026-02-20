# Setup & Deployment Guide

## Project Overview

This is a production-ready NestJS application for managing blockchain network and token configurations with:

- **Automatic cache invalidation** (30-second propagation)
- **Comprehensive audit logging**
- **On-chain token verification**
- **Real-time node health monitoring**
- **RPC URL encryption at rest**

## Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **PostgreSQL**: 12 or higher
- **Redis** (optional, for distributed caching)

## Local Development Setup

### 1. Clone and Install

```bash
cd "Supported Chains & Tokens Configuration"
npm install
```

### 2. Configure Environment

```bash
# Copy example configuration
cp .env.example .env

# Edit .env with your values
```

**.env file contents:**

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=blockchain_config
DB_SSL=false

# Server Configuration
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*

# Security
ENCRYPTION_KEY=your-32-character-encryption-key-here!
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=24h

# Cache
CACHE_TTL=300000  # 5 minutes default

# RPC Configuration
RPC_TIMEOUT=5000
RPC_MAX_RETRIES=3
```

### 3. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE blockchain_config;

# Exit
\q
```

### 4. Start Development Server

```bash
npm run start:dev
```

Expected output:

```
[Nest] 12345   - 01/15/2024, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
[Nest] 12345   - 01/15/2024, 10:30:01 AM     LOG [TypeOrmModule] Database connected successfully
Application is running on: http://localhost:3000
```

### 5. Verify Installation

```bash
# Test the API
curl http://localhost:3000/api/v1/config/chains

# Expected response:
{
  "success": true,
  "data": [],
  "count": 0
}
```

## Project Structure

```
src/
├── config/                           # Main configuration module
│   ├── controllers/
│   │   ├── blockchain-config.controller.ts    # Chain endpoints
│   │   ├── token-config.controller.ts         # Token endpoints
│   │   └── index.ts
│   ├── dtos/                        # Data Transfer Objects
│   │   ├── create-token-config.dto.ts
│   │   ├── update-chain-config.dto.ts
│   │   ├── update-token-config.dto.ts
│   │   └── index.ts
│   ├── entities/                    # TypeORM Entities
│   │   ├── audit-log.entity.ts      # Audit trail
│   │   ├── blockchain-config.entity.ts
│   │   ├── token-config.entity.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── audit.service.ts         # Audit logging
│   │   ├── blockchain-config.service.ts
│   │   ├── cache.service.ts         # Cache management
│   │   ├── encryption.service.ts    # RPC URL encryption
│   │   ├── event.service.ts         # Event publishing
│   │   ├── rpc.service.ts           # RPC utilities
│   │   ├── token-config.service.ts
│   │   └── index.ts
│   └── config.module.ts             # Module definition
├── app.module.ts                    # Root module
├── config.ts                        # Configuration variables
├── main.ts                          # Application bootstrap
├── test/                            # Test files
└── README.md

Root files:
├── package.json
├── tsconfig.json
├── .env.example                     # Environment template
├── .gitignore
├── API_DOCUMENTATION.md             # Complete API docs
└── SETUP_GUIDE.md                   # This file
```

## Database Schema

The application auto-syncs TypeORM entities in development. For production, use migrations.

### Tables Created

**blockchain_configs**

```sql
CREATE TABLE blockchain_configs (
  id UUID PRIMARY KEY,
  chainId VARCHAR UNIQUE NOT NULL,
  displayName VARCHAR NOT NULL,
  rpcUrl VARCHAR NOT NULL,           -- Encrypted
  fallbackRpcUrl VARCHAR,             -- Encrypted
  explorerUrl VARCHAR NOT NULL,
  requiredConfirmations INT NOT NULL,
  isEnabled BOOLEAN DEFAULT true,
  isTestnet BOOLEAN DEFAULT false,
  chainIdNumeric INT DEFAULT 1,
  maxGasLimitGwei DECIMAL(10,2),
  pollingIntervalSeconds INT DEFAULT 30,
  metadata JSONB,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

**token_configs**

```sql
CREATE TABLE token_configs (
  id UUID PRIMARY KEY,
  chainId VARCHAR NOT NULL,
  tokenAddress VARCHAR NOT NULL,
  symbol VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  decimals INT NOT NULL,
  isEnabled BOOLEAN DEFAULT true,
  isNative BOOLEAN DEFAULT false,
  minimumAcceptedAmount DECIMAL(20,8),
  maximumAcceptedAmount DECIMAL(20,8),
  coingeckoId VARCHAR,
  sortOrder INT DEFAULT 0,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(chainId, tokenAddress)
);
```

**audit_logs**

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  action VARCHAR NOT NULL,
  entityType VARCHAR NOT NULL,
  entityId VARCHAR NOT NULL,
  description TEXT NOT NULL,
  changes JSONB NOT NULL,
  userId VARCHAR,
  ipAddress INET,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

## Service Architecture

### BlockchainConfigService

- Manages blockchain network configurations
- Handles RPC URL encryption/decryption
- Provides node health status
- Validates chain disable operations

### TokenConfigService

- Creates and updates token configurations
- Verifies tokens on-chain
- Enforces uniqueness constraints
- Manages token lifecycle

### CacheService

- Manages distributed cache with 30s TTL for chains
- Pattern-based cache invalidation
- Automatic expiration

### AuditService

- Logs all configuration changes
- Captures user context and IP
- Tracks full change diffs

### EncryptionService

- AES-256-CBC encryption/decryption
- Transparent for service layer
- Secures sensitive data at rest

### RpcService

- Verifies token contracts on-chain
- Performs health checks on RPC endpoints
- Uses ethers.js for contract interaction

### EventService

- Publishes real-time configuration change events
- Integration with NestJS EventEmitter
- Enables downstream service updates

## API Endpoints Quick Reference

### Chains

```
GET    /api/v1/config/chains              # List all
GET    /api/v1/config/chains/:chainId     # Get one
PATCH  /api/v1/config/chains/:chainId     # Update
```

### Tokens

```
GET    /api/v1/config/tokens              # List (with filters)
POST   /api/v1/config/tokens              # Create
PATCH  /api/v1/config/tokens/:id          # Update
DELETE /api/v1/config/tokens/:id          # Disable
```

## Development Commands

```bash
# Development (hot reload)
npm run start:dev

# Debug mode
npm run start:debug

# Build
npm run build

# Production
npm run start:prod

# Linting
npm run lint

# Format code
npm run format

# Run tests
npm run test
npm run test:watch
npm run test:cov

# E2E tests
npm run test:e2e
```

## Testing

### Unit Tests

```bash
# Run all tests
npm run test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:cov
```

### Manual API Testing with cURL

```bash
# List chains
curl http://localhost:3000/api/v1/config/chains

# Get specific chain
curl http://localhost:3000/api/v1/config/chains/base

# List tokens
curl http://localhost:3000/api/v1/config/tokens?chainId=base

# Create token
curl -X POST http://localhost:3000/api/v1/config/tokens \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": "base",
    "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "symbol": "USDC",
    "name": "USD Coin",
    "decimals": 6,
    "minimumAcceptedAmount": "0.01"
  }'

# Update token
curl -X PATCH http://localhost:3000/api/v1/config/tokens/uuid-here \
  -H "Content-Type: application/json" \
  -d '{"isEnabled": true}'

# Update chain
curl -X PATCH http://localhost:3000/api/v1/config/chains/base \
  -H "Content-Type: application/json" \
  -d '{"requiredConfirmations": 15}'

# Disable token
curl -X DELETE http://localhost:3000/api/v1/config/tokens/uuid-here
```

### Testing with Postman

1. Import collection from `docs/postman_collection.json` (create this)
2. Set environment variables:
   - `baseUrl`: http://localhost:3000
   - `token`: JWT token if using auth
3. Run requests in sequence

## Production Deployment

### Build for Production

```bash
# Install dependencies
npm ci

# Build application
npm run build

# Run production server
npm run start:prod
```

### Docker Deployment

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built application
COPY dist ./dist

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/v1/config/chains', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["node", "dist/main.js"]
```

Build and run:

```bash
docker build -t blockchain-config-admin:latest .
docker run -p 3000:3000 --env-file .env blockchain-config-admin:latest
```

### Docker Compose Deployment

Create `docker-compose.yml`:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: blockchain_config
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USERNAME: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      DB_DATABASE: blockchain_config
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:
```

Run:

```bash
docker-compose up -d
```

### Environment Setup for Production

```env
# Production settings
NODE_ENV=production
PORT=3000

# Database (use managed service)
DB_HOST=prod-db.example.com
DB_PORT=5432
DB_USERNAME=prod_user
DB_PASSWORD=strong-password-here
DB_DATABASE=blockchain_config
DB_SSL=true

# Security (generate strong keys)
ENCRYPTION_KEY=generate-32-char-key-use-openssl
JWT_SECRET=generate-strong-jwt-secret
JWT_EXPIRES_IN=24h

# Performance
CORS_ORIGIN=https://your-domain.com
CACHE_TTL=300000

# RPC
RPC_TIMEOUT=5000
RPC_MAX_RETRIES=3
```

### Health Checks

```bash
# Kubernetes liveness probe
curl http://localhost:3000/api/v1/config/chains

# Expected: 200 OK with data
```

## Monitoring & Logging

### Application Logs

Logs are output to stdout/stderr. Configure with environment:

```env
LOG_LEVEL=debug  # development
LOG_LEVEL=warn   # production
```

### Database Monitoring

Monitor slow queries:

```sql
-- View slow query log
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Performance Metrics

Track cache hit/miss ratio:

```typescript
// In monitoring service
const hitRate = cacheHits / (cacheHits + cacheMisses);
```

## Troubleshooting

### Database Connection Failed

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**

- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check DB credentials in .env
- Ensure database exists: `psql -U postgres -l`

### Token Verification Failed

```
Error: Token verification failed for 0x...
```

**Solution:**

- Verify RPC endpoint is accessible
- Check token contract address
- Ensure symbol and decimals match contract
- Check network and contract deployment

### Cache Not Invalidating

```
Problem: Changes not reflected immediately
```

**Solution:**

- Verify cache manager is connected
- Check cache TTL settings
- Monitor cache in Redis: `redis-cli KEYS '*'`
- Clear cache manually: `redis-cli FLUSHDB`

### Encryption Key Issues

```
Error: Decryption failed
```

**Solution:**

- Verify ENCRYPTION_KEY is set
- Ensure key is 32+ characters
- Re-encrypt data if key changed

## Backup & Restore

### PostgreSQL Backup

```bash
# Full backup
pg_dump -U postgres blockchain_config > backup.sql

# Compressed backup
pg_dump -U postgres -Fc blockchain_config > backup.dump

# Restore
psql -U postgres blockchain_config < backup.sql
```

### Configuration Export

```sql
-- Export all configs
SELECT json_agg(row_to_json(t))
FROM blockchain_configs t;

SELECT json_agg(row_to_json(t))
FROM token_configs t;
```

## Performance Optimization

### Indexes

Current indexes on:

- `blockchain_configs.chainId` (unique)
- `token_configs.chainId, tokenAddress` (unique)
- `audit_logs.entityType, entityId`

### Caching Strategy

- **Chain configs**: 30s TTL (fast propagation)
- **Token lists**: Default TTL
- **Cache hit rate**: Target 90%+

### Query Optimization

- Pagination for large result sets
- Connection pooling in production
- Read replicas for reporting queries

## Security Checklist

- [ ] Encryption key is 32+ characters
- [ ] JWT secret is strong and unique
- [ ] Database password is strong
- [ ] CORS origins are restricted
- [ ] HTTPS enabled in production
- [ ] Database SSL enabled
- [ ] API rate limiting implemented
- [ ] Input validation enforced
- [ ] Audit logs reviewed regularly
- [ ] Sensitive data encrypted

## Support & Resources

- **NestJS Documentation**: https://docs.nestjs.com
- **TypeORM Documentation**: https://typeorm.io
- **PostgreSQL Documentation**: https://www.postgresql.org/docs
- **Ethers.js Documentation**: https://docs.ethers.org

## Next Steps

1. ✅ Install and configure locally
2. ✅ Test API endpoints with sample data
3. ✅ Review and customize for your needs
4. ✅ Set up monitoring and logging
5. ✅ Deploy to production environment
6. ✅ Configure automated backups
7. ✅ Implement additional security policies
