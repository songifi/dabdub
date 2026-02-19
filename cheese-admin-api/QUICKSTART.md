# Quick Start Guide - Cheese Admin Dashboard API

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js 18+ (verify with `node --version`)
- npm 10+ (verify with `npm --version`)

### Installation

```bash
# Navigate to the project
cd cheese-admin-api

# Install dependencies (if not already done)
npm install
```

### Start Development

```bash
# Start in watch mode (auto-reload on file changes)
npm run start:dev

# Server will start at http://localhost:3000
```

### Run Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:cov
```

### Code Quality

```bash
# Check code for issues
npm run lint

# Format code automatically
npm run format
```

## 📝 Development Workflow

### Creating a New Feature Module

```bash
# Generate a new module (replaces my-module with actual name)
nest generate module modules/my-module
nest generate controller modules/my-module
nest generate service modules/my-module
```

### Writing Tests

```typescript
// Example: src/modules/my-module/my-module.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { MyModuleService } from './my-module.service';

describe('MyModuleService', () => {
  let service: MyModuleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MyModuleService],
    }).compile();

    service = module.get<MyModuleService>(MyModuleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### Using Path Aliases in Imports

Instead of:
```typescript
import { Logger } from '../../../common/logger';
```

Use:
```typescript
import { Logger } from '@common/logger';
import { UserService } from '@modules/admin-users/user.service';
import { AppConfig } from '@config/app.config';
```

## 🔄 Git Workflow

### Before Creating a Pull Request

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and ensure code quality:
   ```bash
   npm run build    # Check compilation
   npm run lint     # Check code quality
   npm run test     # Run tests
   ```

3. Commit following Conventional Commits:
   ```bash
   git add .
   git commit -m "feat(scope): short description"
   ```

4. Push and create a pull request:
   ```bash
   git push origin feature/your-feature-name
   ```

## 📂 Project Structure

```
src/
├── common/          # Shared utilities (decorators, guards, filters, etc.)
├── config/          # Configuration management
├── modules/         # Feature modules
│   ├── auth/
│   ├── admin-users/
│   ├── merchants/
│   └── ...
├── database/        # Database migrations and seeds
├── app.module.ts    # Root module
└── main.ts          # Entry point

test/
├── e2e/            # End-to-end tests
├── helpers/        # Test utilities
└── factories/      # Test data factories
```

## 🛠 Common Commands

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start development server with watch mode |
| `npm run start:debug` | Start with Node debugger enabled (port 9229) |
| `npm run build` | Build for production |
| `npm run lint` | Check code quality with ESLint |
| `npm run format` | Format code with Prettier |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Generate test coverage report |
| `npm run test:e2e` | Run e2e tests |

## 🔍 Debugging

### Debug in VS Code

1. Add a breakpoint in your code
2. Run: `npm run start:debug`
3. Open VS Code's Run and Debug panel
4. Create a launch configuration for Node.js debugger
5. Connect to port 9229

### Browser DevTools

If using NestJS with a frontend:
1. Open Chrome DevTools (F12)
2. Go to Sources tab
3. Server code will be available if source maps are enabled

## ✅ Code Quality Standards

### No console.log
Use the NestJS Logger instead:

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  doSomething() {
    this.logger.log('Information message');
    this.logger.error('Error message', error);
  }
}
```

### No any types
Always use proper TypeScript types:

```typescript
// ❌ Bad
function processData(data: any) {
  return data.value;
}

// ✅ Good
interface DataObject {
  value: string;
}

function processData(data: DataObject) {
  return data.value;
}
```

### Import Ordering
Keep imports organized:
1. Node.js built-ins
2. Third-party libraries
3. Internal modules (using @aliases)

## 📚 Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Jest Testing Guide](https://jestjs.io)
- [ESLint Rules](https://eslint.org/docs/rules/)
- Project [README.md](./README.md)
- Contribution guidelines [CONTRIBUTING.md](./CONTRIBUTING.md)

## ❓ Troubleshooting

### Port 3000 Already in Use
```bash
PORT=3001 npm run start:dev
```

### Module Not Found Errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors in IDE
- In VS Code: Press Cmd/Ctrl + Shift + P
- Type "TypeScript: Select TypeScript Version"
- Choose "Use Workspace Version"

### Tests Not Running
```bash
# Rebuild Jest cache
npm test -- --clearCache
npm test
```

## 🚢 Deployment

### Build for Production

```bash
npm run build
```

### Run Production Build

```bash
npm run start:prod
```

### Environment Setup

Create `.env.production` file with production values (see `.env.example` template).

---

**Need Help?** Check the [README.md](./README.md) or [CONTRIBUTING.md](./CONTRIBUTING.md) for more detailed information.
