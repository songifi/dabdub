# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### Step 1: Install Dependencies (1 minute)

```bash
cd "Supported Chains & Tokens Configuration"
npm install
```

### Step 2: Configure Environment (1 minute)

```bash
cp .env.example .env
# Edit .env with your database credentials
```

Minimum required in .env:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=blockchain_config
ENCRYPTION_KEY=your-32-character-encryption-key-here!
```

### Step 3: Start Database (1 minute)

```bash
# If using Docker Compose (easiest)
docker-compose up -d postgres

# OR if PostgreSQL already running, just create the database
psql -U postgres -c "CREATE DATABASE blockchain_config;"
```

### Step 4: Start Development Server (1 minute)

```bash
npm run start:dev
```

Expected output:

```
[Nest] 12345   - 01/15/2024, 10:30:00 AM     LOG [NestFactory] Starting Nest application...
Application is running on: http://localhost:3000
```

### Step 5: Test It Works (1 minute)

```bash
curl http://localhost:3000/api/v1/config/chains
```

Expected response:

```json
{
  "success": true,
  "data": [],
  "count": 0
}
```

✅ **You're running!**

---

## 📋 Common Tasks

### Create a New Chain

```bash
curl -X POST http://localhost:3000/api/v1/config/chains \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": "base",
    "displayName": "Base Mainnet",
    "rpcUrl": "https://mainnet.base.org",
    "explorerUrl": "https://basescan.org",
    "requiredConfirmations": 12,
    "chainIdNumeric": 8453,
    "maxGasLimitGwei": "100.00"
  }'
```

### List All Chains

```bash
curl http://localhost:3000/api/v1/config/chains
```

### Add a Token

```bash
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
```

### Enable a Token

```bash
curl -X PATCH http://localhost:3000/api/v1/config/tokens/{token-id} \
  -H "Content-Type: application/json" \
  -d '{"isEnabled": true}'
```

### Update Chain Config

```bash
curl -X PATCH http://localhost:3000/api/v1/config/chains/base \
  -H "Content-Type: application/json" \
  -d '{"requiredConfirmations": 15}'
```

---

## 🐳 Using Docker Compose (Easiest)

```bash
# Start everything (database + app)
docker-compose up

# In another terminal, verify it's working
curl http://localhost:3000/api/v1/config/chains

# Stop everything
docker-compose down
```

---

## 📚 Key Documentation

| Document                                     | For...                       |
| -------------------------------------------- | ---------------------------- |
| [README.md](README.md)                       | Project overview             |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | All endpoints & examples     |
| [SETUP_GUIDE.md](SETUP_GUIDE.md)             | Installation & deployment    |
| [DEVELOPMENT.md](DEVELOPMENT.md)             | Code patterns & architecture |

---

## 🧪 Run Tests

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov
```

---

## 🔧 Development Commands

```bash
# Development (hot reload)
npm run start:dev

# Build
npm run build

# Production
npm run start:prod

# Linting
npm run lint

# Format code
npm run format
```

---

## 📁 Project Structure

```
src/config/
├── controllers/           # HTTP endpoints
├── services/             # Business logic
├── entities/             # Database models
├── dtos/                 # Input validation
└── config.module.ts      # Module definition
```

---

## 🔐 Security Notes

- RPC URLs encrypted at rest
- Audit trail for all changes
- Input validation on all endpoints
- Transaction safety checks

---

## ⚡ Performance

- **Cached responses**: ~5ms
- **DB queries**: ~50-100ms
- **Cache TTL**: 30 seconds
- **Propagation**: <30 seconds

---

## 🆘 Troubleshooting

**Error: "Cannot connect to database"**

- Verify PostgreSQL is running
- Check .env credentials
- Ensure database exists

**Error: "Port 3000 already in use"**

- Change PORT in .env
- Or kill existing process

**Encryption error**

- Ensure ENCRYPTION_KEY is 32+ characters
- Cannot decrypt if key changed

---

## 📞 Need Help?

1. Check [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for endpoint details
2. Review examples in `src/config/services/`
3. Run tests: `npm run test`
4. Check logs in console

---

## ✅ You Now Have:

- ✅ Fully functional blockchain config API
- ✅ Real-time configuration updates
- ✅ On-chain token verification
- ✅ Complete audit trail
- ✅ Encrypted storage
- ✅ Comprehensive documentation
- ✅ Production-ready code
- ✅ Docker deployment ready

**Start building! 🚀**
