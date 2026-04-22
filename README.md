# Universal Crypto-to-Fiat Settlement

> **Seamless crypto payments, instant fiat settlements** - A multi-chain settlement infrastructure that bridges Web3 payments with traditional banking, enabling merchants to accept stablecoin payments and receive instant fiat settlements.

## Overview

Cheese is a B2B2C payment settlement platform that enables businesses to accept cryptocurrency payments (USDC) from customers while receiving instant fiat settlements in their bank accounts. Built with multi-chain support across EVM and non-EVM networks, it abstracts away blockchain complexity for merchants while providing secure, compliant, and fast payment processing.

### Key Value Propositions

- **Zero Crypto Knowledge Required**: Merchants receive fiat, customers pay crypto
- **Multi-Chain Support**: Works across 7+ blockchain networks
- **Instant Settlement**: Automated crypto-to-fiat conversion and bank transfers
- **QR Code Payments**: Simple scan-and-pay experience
- **Enterprise-Grade**: Built for scale with monitoring, webhooks, and APIs
- **Progressive Web App**: Works offline, installable on any device

## Architecture

### Technology Stack

#### Backend (Settlement API)
- **Framework**: NestJS (TypeScript)
- **Database**: PostgreSQL with TypeORM
- **Blockchain Integration**: ethers.js, Stellar SDK, Starknet.js, Stacks.js
- **Payment Processing**: Automated monitoring and settlement
- **API Design**: RESTful with webhook support
- **Job Scheduling**: Cron-based blockchain monitoring

#### Frontend (Merchant & Customer Portal)
- **Framework**: Next.js 14 (App Router)
- **Type Safety**: TypeScript
- **Styling**: Tailwind CSS
- **PWA Support**: Offline-first architecture
- **State Management**: React Context / Zustand
- **Web3 Integration**: wagmi, viem, RainbowKit
- **QR Generation**: qrcode.react

### Supported Blockchain Networks

#### EVM-Compatible Chains
1. **Polygon** (Layer 2 Ethereum)
   - Gas: Ultra-low (~$0.01)
   - Speed: ~2 seconds
   - Best for: High-volume transactions

2. **Base** (Coinbase L2)
   - Gas: Low (~$0.02)
   - Speed: ~2 seconds
   - Best for: Coinbase ecosystem integration

3. **Celo** (Mobile-first EVM)
   - Gas: Ultra-low (~$0.001)
   - Speed: ~5 seconds
   - Best for: Mobile payments, emerging markets

4. **Arbitrum** (Optimistic Rollup)
   - Gas: Low (~$0.02)
   - Speed: ~1 second
   - Best for: DeFi integrations

5. **Optimism** (Optimistic Rollup)
   - Gas: Low (~$0.02)
   - Speed: ~2 seconds
   - Best for: Ethereum ecosystem

#### Non-EVM Chains
6. **Starknet** (ZK-Rollup)
   - Gas: Very low
   - Speed: ~10 seconds
   - Best for: High-security applications

7. **Stellar** (Fast & Low-Cost)
   - Gas: Minimal (~$0.0001)
   - Speed: ~5 seconds
   - Best for: Cross-border payments, remittances

8. **Stacks** (Bitcoin Layer 2)
   - Gas: Moderate
   - Speed: Bitcoin block time
   - Best for: Bitcoin-secured settlements


## Features

### Core Functionality

#### 1. Payment Request Generation
- Generate unique payment requests with QR codes
- Multi-chain support with automatic network selection
- Customizable expiration times
- Real-time exchange rate conversion
- Merchant metadata attachment

#### 2. Blockchain Monitoring
- Automated deposit detection across all supported chains
- Block-by-block transaction scanning
- Intelligent payment matching algorithms
- Confirmation tracking (12+ confirmations for security)
- Failed transaction handling and retry logic

#### 3. Settlement Automation
- Automatic fiat conversion via partner liquidity providers
- Bank transfer execution
- Multi-currency support (USD, NGN, EUR, GBP, etc.)
- Batch settlement optimization
- Settlement status tracking

#### 4. Merchant Dashboard
- Real-time payment tracking
- Transaction history and analytics
- Settlement reports and exports
- API key management
- Webhook configuration
- Multi-user access control

#### 5. Developer Tools
- RESTful API with comprehensive documentation
- Webhook system for real-time notifications
- SDK support (JavaScript/TypeScript, Python, Go)
- Sandbox environment for testing
- Postman collection and OpenAPI specs
- Swagger documentation for API docs

**Waitlist API**
- Join waitlist: `POST /v1/waitlist/join`
- Username availability: `GET /v1/waitlist/check/:username`
- Stats: `GET /v1/waitlist/stats`


### Advanced Features

#### Security
- Multi-signature wallet support
- Rate limiting and DDoS protection
- API key authentication with scopes
- Encrypted data storage
- Audit logging for compliance
- PCI-DSS compliance ready

#### Monitoring & Observability
- Prometheus metrics export
- Grafana dashboard templates
- Sentry error tracking
- Transaction tracing
- Performance monitoring
- Uptime monitoring with alerting

#### Scalability
- Horizontal scaling support
- Database connection pooling
- Redis caching for hot data
- Message queue for async processing
- Load balancing ready
- CDN integration for static assets



## Installation & Setup

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- PostgreSQL 14+
- Redis 6+ (optional, for caching)
- Docker & Docker Compose (recommended)

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/yourusername/cryptosettle.git
cd cryptosettle

# Copy environment variables
cp .env.example .env

# Edit .env with your configurations
nano .env

# Start all services with Docker Compose
docker-compose up -d

# Backend will be available at http://localhost:3000
# Frontend will be available at http://localhost:3001
```

### Manual Setup

#### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configurations

# Run database migrations
npm run migration:run

# Start development server
npm run start:dev

# Run tests
npm run test
npm run test:e2e
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your configurations

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

### Environment Variables

#### Backend (.env)

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=cryptosettle

# Redis (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Blockchain Wallets
DEPOSIT_WALLET_ADDRESS=0xYourDepositWalletAddress
TREASURY_WALLET_PRIVATE_KEY=0xYourTreasuryPrivateKey

# EVM RPC Endpoints
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
CELO_RPC_URL=https://forno.celo.org
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
OPTIMISM_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY

# Non-EVM Networks
STELLAR_NETWORK=PUBLIC # or TESTNET
STELLAR_ACCOUNT_SECRET=SXXX...
STARKNET_RPC_URL=https://starknet-mainnet.public.blastapi.io
STARKNET_PRIVATE_KEY=0x...
STACKS_RPC_URL=https://stacks-node-api.mainnet.stacks.co
STACKS_PRIVATE_KEY=...

# Partner API (Fiat Liquidity Provider)
PARTNER_API_URL=https://partner-api.com/v1
PARTNER_API_KEY=your_partner_api_key

# Security
JWT_SECRET=your_jwt_secret_key_min_32_chars
API_KEY_SALT=your_api_key_salt

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
```

#### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:3000

# Blockchain Network IDs
NEXT_PUBLIC_POLYGON_CHAIN_ID=137
NEXT_PUBLIC_BASE_CHAIN_ID=8453
NEXT_PUBLIC_CELO_CHAIN_ID=42220

# WalletConnect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Analytics (Optional)
NEXT_PUBLIC_GA_TRACKING_ID=G-XXXXXXXXXX
```



### Webhook Events

Cheese sends webhooks for the following events:

- `payment.created` - New payment request created
- `payment.confirmed` - Payment confirmed on blockchain
- `payment.settling` - Fiat settlement in progress
- `payment.settled` - Merchant received fiat
- `payment.failed` - Payment or settlement failed
- `payment.expired` - Payment request expired


## 🌐 Blockchain Integration Details

### EVM Networks (Polygon, Base, Celo, Arbitrum, Optimism)

**Token Standard:** ERC-20 (USDC)



## 🎨 Frontend Features

### Progressive Web App (PWA)

- **Offline Support**: Works without internet connection
- **Installable**: Add to home screen on mobile devices
- **Push Notifications**: Real-time payment updates
- **Background Sync**: Queue transactions when offline

### Merchant Dashboard

- **Overview**: Real-time metrics and charts
- **Payments**: List, filter, and search all payments
- **Settlements**: Track fiat settlements
- **Analytics**: Revenue trends, conversion rates
- **Settings**: API keys, webhooks, profile

### Customer Payment Flow

1. Scan QR code with any Web3 wallet
2. Auto-populate payment details
3. Confirm transaction
4. Real-time status updates
5. Receipt generation


### Cloud Platforms

#### Railway
```bash
railway up
```

#### Vercel (Frontend)
```bash
vercel --prod
```


### Project Links
- **Website**: [https://dabdub.xyz](https://Cheesepay.xyz)
- **Documentation**: [https://docs.dabdub.xyz](https://docs.Cheesepay.xyz)
- **API Reference**: [https://api.dabdub.xyz/docs](https://api.Cheesepay.xyz/docs)
- **Status Page**: [https://status.dabdub.xyz](https://status.Cheesepay.xyz)

### Community
- **Twitter**: [@CryptoSettle](https://twitter.com/Cheesepay)
- **Telegram**: [CryptoSettle Community](https://t.me/Cheesepay)


## 📞 Support

- **Email**: support@Cheesepay.xyz
- **Enterprise Inquiries**: enterprise@Cheesepay.xyz



Built with ❤️ by the CheesePay team

## Contract Development

### Prerequisites

```bash
# Rust + wasm target
rustup target add wasm32v1-none

# Stellar CLI (v25.2.0)
cargo install --locked stellar-cli
```

### Run tests

```bash
cargo test
```

### Build WASM

```bash
cargo wasm-build
```

### Environment

```bash
cp .env.example .env
# fill in ADMIN_SECRET_KEY and USDC_SAC_ADDRESS
```
