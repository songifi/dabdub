# Cheese Admin Dashboard API

Internal control plane API for the Anthropic Cheese B2B2C crypto-to-fiat settlement platform. This is a standalone NestJS application accessible only to internal Anthropic staff with admin credentials.

## Project Purpose

The Admin Dashboard API serves as the centralized management interface for the Cheese settlement platform, enabling internal administrators to:

- Manage admin user accounts and permissions
- Monitor merchant transactions and settlement status
- View and analyze platform analytics and metrics
- Manage system configuration and feature flags
- Audit administrative actions and platform changes
- Execute settlements and manage payment processing
- Monitor system health and performance
- Manage webhooks and integrations

## Architecture Overview

The API is built using NestJS, a progressive Node.js framework that provides:

- **Modular Architecture**: Organized into feature modules (auth, merchants, transactions, settlements, etc.)
- **Dependency Injection**: NestJS's built-in DI container for loosely coupled components
- **TypeScript Support**: Full TypeScript support with strict type checking
- **Middleware & Interceptors**: Request/response processing and transformation
- **Guards & Pipes**: Authentication, authorization, and data validation
- **Decorators**: Custom decorators for common patterns (logging, auth, validation)

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm 10+ or pnpm 8+
- Git

## Local Setup Steps

### 1. Clone the repository

```bash
git clone <repository-url>
cd cheese-admin-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example environment file and configure your local variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration (see Environment Variables Reference below).

### 4. Database setup (if applicable)

```bash
# Run migrations
npm run typeorm migration:run

# Seed development data
npm run seed
```

### 5. Build the project

```bash
npm run build
```

## Environment Variables Reference

Create a `.env.local` file in the project root with the following variables:

```bash
# Application
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=cheese_admin
DATABASE_USER=admin
DATABASE_PASSWORD=password

# Authentication & Security
JWT_SECRET=your-secret-key-here
JWT_EXPIRATION=7d
ADMIN_API_KEY=your-api-key-here

# External Services
MERCHANT_API_URL=http://localhost:3001
SETTLEMENT_SERVICE_URL=http://localhost:3002

# Feature Flags
ENABLE_AUDIT_LOGGING=true
ENABLE_ANALYTICS=true
```

## Running the App

### Development

```bash
npm run start:dev
```

The API will start on `http://localhost:3000` by default.

### Debug Mode

```bash
npm run start:debug
```

This starts the server with Node's debugging protocol enabled. Connect your debugger on port 9229.

### Production

```bash
npm run build
npm run start:prod
```

## Running Tests

### Unit Tests

Run all unit tests:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Generate coverage report:

```bash
npm run test:cov
```

### E2E Tests

Run end-to-end tests:

```bash
npm run test:e2e
```

### Test Coverage

Coverage thresholds are enforced:

- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

Coverage reports are generated in the `./coverage` directory.

## Code Quality

### Linting

```bash
npm run lint
```

ESLint checks TypeScript code for:

- Type safety violations
- No `any` types (strict enforcement)
- No `console.log` outside of production logging
- Proper import ordering

### Formatting

```bash
npm run format
```

Prettier formats code according to project standards:

- Print width: 100 characters
- Single quotes
- Trailing commas
- Semicolons required

### Pre-commit Hooks

Husky automatically runs on every commit:

- **Pre-commit**: Runs ESLint and Prettier on staged files
- **Pre-push**: Runs the full test suite

These hooks ensure code quality before changes enter the repository.

## Project Structure

```
src/
├── common/                 # Shared utilities and infrastructure
│   ├── decorators/        # Custom decorators (auth, logging, etc.)
│   ├── filters/           # Exception filters
│   ├── guards/            # Authentication/authorization guards
│   ├── interceptors/      # Request/response interceptors
│   ├── middleware/        # HTTP middleware
│   ├── pipes/             # Data validation pipes
│   └── types/             # TypeScript type definitions
├── config/                # Configuration management
├── modules/               # Feature modules
│   ├── auth/              # Authentication and authorization
│   ├── admin-users/       # Admin user management
│   ├── merchants/         # Merchant management
│   ├── transactions/      # Transaction tracking
│   ├── settlements/       # Settlement processing
│   ├── analytics/         # Analytics and reporting
│   ├── audit/             # Audit logging
│   ├── webhooks/          # Webhook management
│   ├── config-management/ # System configuration
│   └── exports/           # Data export functionality
├── database/              # Database configuration
│   ├── migrations/        # Database migrations
│   └── seeds/             # Database seeds
├── app.module.ts          # Root module
└── main.ts                # Application entry point

test/
├── e2e/                   # End-to-end tests
├── helpers/               # Test utilities and helpers
└── factories/             # Test data factories
```

## Import Paths

The project uses path aliases for cleaner imports:

```typescript
// Instead of:
import { Logger } from '../../../common/logger';

// Use:
import { Logger } from '@common/logger';
import { UserService } from '@modules/admin-users/user.service';
import { AppConfig } from '@config/app.config';
```

## API Documentation

API documentation will be available at:

- Swagger UI: `http://localhost:3000/api` (when enabled)
- OpenAPI Schema: `http://localhost:3000/api-json`

## Git Workflow

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed information about:

- Branching strategy
- Pull request process
- Commit message format
- Code review expectations

## Common Issues & Troubleshooting

### Port already in use

If port 3000 is in use, specify a different port:

```bash
PORT=3001 npm run start:dev
```

### Module not found errors

Clear node_modules and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

### TypeScript compilation errors

Ensure your IDE is using the project's TypeScript version. In VS Code, use "TypeScript: Select TypeScript Version" and choose "Use Workspace Version".

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Jest Testing Guide](https://jestjs.io/docs/getting-started)
- [ESLint Configuration](https://eslint.org/docs/user-guide/configuring)

## Support

For issues or questions, contact the platform team or create an issue in the repository.

## License

UNLICENSED - Internal Anthropic use only
