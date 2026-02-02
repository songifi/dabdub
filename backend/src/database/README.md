## 🛠 Database Setup Guide

This project uses **PostgreSQL** with **TypeORM** as the ORM layer for robust data persistence.

## Quick Start

### 1. Configure Environment Variables

Copy `.env.example` to `.env` and update the database credentials:

```bash
cp .env.example .env
```

```dotenv
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=dabdub_dev
DB_POOL_SIZE=10
```

### 2. Start PostgreSQL

Ensure PostgreSQL is running on your machine:

```bash
# macOS (using Homebrew)
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Windows (using Docker - recommended)
docker run --name postgres-dabdub -e POSTGRES_PASSWORD=your_postgres_password -p 5432:5432 -d postgres:15
```

### 3. Create the Database

```bash
# Connect to PostgreSQL
psql -U postgres -h localhost

# Inside psql, create the database:
CREATE DATABASE dabdub_dev;

# Exit psql
\q
```

### 4. Run Migrations and Seeds

```bash
# Run all migrations and seeds
npm run db:setup

# Or run separately:
npm run migration:run
npm run seed:run
```

You should see output like:

```
✓ Migration completed
🌱 Starting database seeding...
✓ Created user: admin@dabdub.com (admin)
✓ Created merchant: merchant1@test.com
✅ Database seeding completed successfully!
```

## Database Commands

### Migrations

```bash
# Run all pending migrations
npm run migration:run

# Revert the last migration
npm run migration:revert

# Check migration status
npm run migration:status

# Test migrations
npm run test:migrations

# Generate a new migration from entities (requires build first)
npm run build
npx typeorm migration:generate -d dist/typeorm.config.js src/database/migrations/DescriptionOfChange
```

### Seeding

```bash
# Run database seeds (populate with initial data)
npm run seed:run

# Check seed status
npm run seed:status
```

### Database Management

```bash
# Setup database (migrations + seeds)
npm run db:setup

# Reset database (revert, migrate, seed)
npm run db:reset
```

## Project Structure

```
src/database/
├── database.module.ts                    # TypeORM configuration & setup
├── database-config.ts                    # Shared database config for CLI tools
├── health.indicator.ts                   # Database health check provider
├── README.md                             # This file
├── MIGRATION_CONVENTIONS.md              # Migration naming & best practices
├── PRODUCTION_MIGRATION_GUIDE.md         # Production deployment guide
├── entities/
│   ├── base.entity.ts                   # Base class for all entities
│   ├── user.entity.ts                   # User entity
│   ├── merchant.entity.ts               # Merchant entity
│   ├── payment-request.entity.ts        # Payment request entity
│   ├── settlement.entity.ts             # Settlement entity
│   ├── wallet.entity.ts                 # Wallet entity
│   ├── evm-transaction.entity.ts        # EVM transaction entity
│   └── ...                              # Other entities
├── migrations/
│   ├── 1704067200000-CreateUsersTable.ts
│   ├── 1738267200000-CreateMerchantsTable.ts
│   ├── 1738267200001-CreatePaymentRequestsTable.ts
│   ├── 1738267200002-CreateSettlementsTable.ts
│   ├── 1738267200003-CreateWalletsTable.ts
│   ├── 1738267200004-CreateEvmTransactionsTable.ts
│   ├── 1738267200005-AddIndexes.ts
│   ├── 1738267200006-AddForeignKeyConstraints.ts
│   └── ...                              # Add new migrations here
└── seeds/
    ├── database.seeder.ts               # Main seeding orchestrator
    ├── user.seeder.ts                   # User seed data
    ├── merchant.seeder.ts               # Merchant seed data
    ├── payment-request.seeder.ts        # Payment request seed data
    ├── network-config.seeder.ts         # Network configuration seed data
    ├── exchange-rate.seeder.ts          # Exchange rate seed data
    ├── seed-version.seeder.ts           # Seed versioning
    └── ...                              # Add seed data here
```

## Migration System

### Available Migrations

1. **CreateMerchantsTable** - Merchants with status tracking
2. **CreatePaymentRequestsTable** - Payment requests with full lifecycle
3. **CreateSettlementsTable** - Settlement processing
4. **CreateWalletsTable** - Wallet management
5. **CreateEvmTransactionsTable** - EVM blockchain transactions
6. **AddIndexes** - Performance indexes for all tables
7. **AddForeignKeyConstraints** - Referential integrity

### Migration Features

- ✅ Automatic rollback support
- ✅ Transaction-based execution
- ✅ Comprehensive indexing
- ✅ Foreign key constraints
- ✅ Enum type support
- ✅ JSONB for flexible data
- ✅ Timestamp tracking
- ✅ UUID primary keys

## Seed Data

### Default Users

```
Admin:    admin@dabdub.com / Admin123!
Merchant: merchant@dabdub.com / Merchant123!
User:     user@dabdub.com / User123!
Test:     test@dabdub.com / Test123!
```

### Test Merchants

- merchant1@test.com - Test Merchant 1 (Active)
- merchant2@test.com - Test Merchant 2 (Active)
- merchant3@test.com - Test Merchant 3 (Inactive)
- coffee@crypto.com - Crypto Coffee Shop (Active)
- store@digitalgoods.com - Digital Goods Store (Active)

### Network Configurations

- Ethereum Mainnet
- Polygon Mainnet
- Stellar Testnet
- Stellar Mainnet
- Base Mainnet
- Arbitrum One

### Exchange Rates

Pre-seeded exchange rates for:
- USD ↔ BTC, ETH, USDC, USDT, XLM, MATIC
- Stablecoin pairs (USDC ↔ USDT)
- Cross-crypto pairs (ETH ↔ BTC)

### Test Payment Requests

5 sample payment requests with different statuses:
- Completed payment
- Pending payment
- Processing payment
- Failed payment
- Expired payment

## Connection Features

### Connection Pooling

- **Pool Size**: Configured via `DB_POOL_SIZE` (default: 10)
- **Idle Timeout**: 30 seconds
- **Connection Timeout**: 5 seconds
- **Statement Timeout**: 30 seconds

### Query Logging

- **Development**: All queries logged with execution time
- **Production**: Only slow queries (>30s) logged
- Enable/disable via environment: set `NODE_ENV=development` or `NODE_ENV=production`

### SSL Configuration

- **Development**: SSL disabled for easier local development
- **Production**: SSL enabled with `rejectUnauthorized: false`
- Set via environment: `NODE_ENV=production`

## Health Check Endpoint

Monitor database health at runtime:

```bash
curl http://localhost:4000/health
```

Response:

```json
{
  "status": "ok",
  "database": {
    "status": "ok",
    "database": "postgres",
    "responseTime": "2ms",
    "connected": true
  }
}
```

## Creating New Entities

1. Create entity file in `src/database/entities/`:

```typescript
import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar' })
  name: string;
}
```

2. Register in `database.module.ts` (auto-discovered from `src/**/*.entity.ts`)

3. Create migration:

```bash
# Get timestamp
node -e "console.log(Date.now())"

# Create migration file
touch src/database/migrations/{timestamp}-CreateUsersTable.ts
```

4. Review & run migration:

```bash
npm run migration:run
```

## Naming Conventions

See [MIGRATION_CONVENTIONS.md](./MIGRATION_CONVENTIONS.md) for:

- Entity naming patterns
- Table & column naming rules
- Relationship conventions
- Index naming standards
- Migration best practices

## Production Deployment

See [PRODUCTION_MIGRATION_GUIDE.md](./PRODUCTION_MIGRATION_GUIDE.md) for:

- Pre-migration checklist
- Backup procedures
- Migration execution steps
- Rollback procedures
- Post-migration verification
- Monitoring guidelines

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

- Ensure PostgreSQL is running
- Check `DB_HOST` and `DB_PORT` in `.env`

### Migration Conflicts

- Don't manually edit migration files after they're run
- For local development, use `npm run migration:revert` and regenerate
- In production, create new migration files to undo changes

### Query Timeouts

- Default timeout is 30 seconds
- Optimize slow queries with proper indexes
- Check `MIGRATION_CONVENTIONS.md` for indexing patterns

### Seed Data Already Exists

Seeds are idempotent - they check for existing data before inserting:

```
- User already exists: admin@dabdub.com
- Merchant already exists: merchant1@test.com
```

This is normal and safe to ignore.

## Testing

### Run Migration Tests

```bash
npm run test:migrations
```

Tests verify:
- ✅ All migrations execute successfully
- ✅ All tables are created
- ✅ Indexes are properly configured
- ✅ Foreign keys are enforced
- ✅ Rollbacks work correctly
- ✅ Data integrity constraints

## Additional Resources

- [TypeORM Documentation](https://typeorm.io/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Migration Conventions](./MIGRATION_CONVENTIONS.md)
- [Production Migration Guide](./PRODUCTION_MIGRATION_GUIDE.md)

