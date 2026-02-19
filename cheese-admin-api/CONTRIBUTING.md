# Contributing to Cheese Admin Dashboard API

Thank you for your interest in contributing to the Cheese Admin Dashboard API! This document provides guidelines and instructions for contributing code to this project.

## Code of Conduct

All contributors are expected to follow professional and respectful behavior. Treat all team members with respect and maintain a collaborative environment.

## Getting Started

1. Ensure you have Node.js 18+ and npm 10+ installed
2. Clone the repository and install dependencies
3. Create a feature branch from the main development branch
4. Make your changes and commit them following the guidelines below
5. Submit a pull request with a clear description of your changes

## Branching Strategy

Use the following branch naming convention:

### Feature Branches

For new features:

```bash
git checkout -b feature/short-description
```

Example: `feature/admin-user-management`, `feature/settlement-processing`

### Fix Branches

For bug fixes:

```bash
git checkout -b fix/short-description
```

Example: `fix/auth-token-validation`, `fix/merchant-data-sync`

### Chore Branches

For maintenance, documentation, or configuration updates:

```bash
git checkout -b chore/short-description
```

Example: `chore/update-dependencies`, `chore/add-logging`

## Commit Message Format

We follow the Conventional Commits specification for clear, structured commit messages.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

Must be one of:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that don't affect code meaning (formatting, semicolons, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Code change that improves performance
- **test**: Adding or updating tests
- **chore**: Changes to build process, dependencies, or tools
- **ci**: Changes to CI/CD configuration

### Scope

Optional but recommended. The scope should specify what area of the code is affected:

- `auth`
- `users`
- `merchants`
- `transactions`
- `settlements`
- `analytics`
- `config`
- etc.

### Subject

- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period (.) at the end
- Max 50 characters

### Body

Optional but recommended for non-trivial changes:

- Explain **what** and **why**, not how
- Wrap at 72 characters
- Separate from subject with a blank line

### Footer

Optional:

- Reference issues with `Fixes #123` or `Closes #456`
- Note breaking changes with `BREAKING CHANGE: description`

### Examples

```
feat(auth): add JWT refresh token rotation

Implement automatic refresh token rotation on each authentication
to improve security. Tokens now expire after 7 days and refresh
tokens are invalidated after use.

Fixes #123
```

```
fix(transactions): handle concurrent settlement updates

Prevent race conditions when multiple settlement processes attempt
to update transaction status simultaneously by implementing
distributed locking with Redis.

Closes #456
```

```
docs: update API documentation

Update OpenAPI schema and Swagger documentation to reflect
current endpoints and response formats.
```

## Pull Request Process

### Before Creating a Pull Request

1. **Ensure your code is correct**:

   ```bash
   npm run build
   npm run lint
   npm run test
   ```

2. **Update documentation** if you've changed behavior, APIs, or configuration

3. **Add or update tests** for new functionality

4. **Pull the latest changes** from the main branch

   ```bash
   git pull origin main
   ```

5. **Rebase your branch** on main if needed:

   ```bash
   git rebase origin/main
   ```

### Creating a Pull Request

#### Title

Use a clear title following the commit message format:

- `feat(scope): short description`
- `fix(scope): short description`

#### Description

Include:

- **Summary**: Brief description of changes
- **Type of Change**: Which of the following apply?
  - [ ] New feature
  - [ ] Bug fix
  - [ ] Breaking change
  - [ ] Documentation update
- **Related Issues**: Link to related issues (e.g., `Fixes #123`)
- **Testing**: Describe testing performed
- **Checklist**: Self-review checklist (see below)

#### PR Checklist

```markdown
## Checklist

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have updated the documentation accordingly
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published
- [ ] The commit message(s) follow Conventional Commits format
```

### Code Review

- All pull requests require review and approval before merging
- Maintainers will review code quality, testing, and alignment with project standards
- Address all review feedback promptly
- Request review from team members with expertise in the affected areas

### After Approval

- Ensure your branch is up to date with main
- Use "Squash and merge" if you have multiple commits for a single feature
- Delete the branch after merging

## Code Quality Standards

### TypeScript

- Use strict TypeScript mode (`"strict": true`)
- No `any` types - use proper typing
- Use interfaces for contracts, types for data
- Export public APIs from index files

### ESLint & Prettier

Code must pass linting:

```bash
npm run lint
```

Code must be properly formatted:

```bash
npm run format
```

These run automatically on git hooks, but you can run manually.

### Testing

- Write unit tests for all new functionality
- Maintain or improve code coverage (80% statements, 75% branches)
- Use descriptive test names
- Follow AAA pattern: Arrange, Act, Assert

```typescript
describe('UserService', () => {
  it('should create a new user with valid data', async () => {
    // Arrange
    const userData = { name: 'John', email: 'john@example.com' };
    
    // Act
    const user = await userService.create(userData);
    
    // Assert
    expect(user.name).toBe('John');
  });
});
```

### Naming Conventions

- **Classes**: PascalCase (`UserService`, `AdminController`)
- **Functions/Methods**: camelCase (`getUserById`, `validateEmail`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **Files**: kebab-case for general files (`user.service.ts`, `admin.controller.ts`)

### Module Organization

Each module should follow this structure:

```
module-name/
├── module-name.module.ts
├── module-name.controller.ts
├── module-name.service.ts
├── module-name.controller.spec.ts
├── module-name.service.spec.ts
├── dto/
│   ├── create-item.dto.ts
│   └── update-item.dto.ts
├── entities/
│   └── item.entity.ts
├── interfaces/
│   └── item.interface.ts
└── index.ts
```

### Import Organization

Order imports as follows:

1. Node.js built-ins (`fs`, `path`, etc.)
2. Third-party libraries (`@nestjs/*`, `@nestjs/common`, etc.)
3. Internal modules and utilities (use path aliases like `@common/*`)
4. Relative imports (last resort)

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Logger } from '@common/logger';
import { UserService } from '@modules/users/user.service';

import { User } from './entities/user.entity';
```

### Logging

Use the NestJS Logger, never `console.log`:

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name);

  doSomething() {
    this.logger.log('This is an info log');
    this.logger.error('This is an error', error);
    this.logger.warn('This is a warning');
    this.logger.debug('Debug information');
  }
}
```

### Error Handling

Use appropriate NestJS exceptions:

```typescript
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';

// For specific errors
throw new NotFoundException('User not found');

// For custom errors
throw new HttpException(
  { message: 'Custom error message' },
  HttpStatus.BAD_REQUEST,
);
```

## Development Workflow

### Running the Application

Development mode with hot reload:

```bash
npm run start:dev
```

Debug mode:

```bash
npm run start:debug
```

Production mode:

```bash
npm run build
npm run start:prod
```

### Running Tests

All tests:

```bash
npm run test
```

Watch mode:

```bash
npm run test:watch
```

Coverage:

```bash
npm run test:cov
```

E2E tests:

```bash
npm run test:e2e
```

## Common Issues

### Pre-commit hooks not working

If Husky hooks aren't executing:

```bash
npx husky install
chmod +x .husky/pre-commit
chmod +x .husky/pre-push
```

### TypeScript compilation errors

Verify you're using the workspace TypeScript version:

- In VS Code: Command Palette > "TypeScript: Select TypeScript Version" > "Use Workspace Version"

### Module resolution errors

Clear cache and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Reporting Issues

When reporting bugs, include:

- Description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment (Node.js version, OS, etc.)
- Relevant logs or error messages
- Screenshots if applicable

## Feature Requests

Feature requests are welcome! Please include:

- Clear description of the feature
- Use cases and benefits
- Possible implementation approach
- Examples of similar features in other projects

## Questions or Need Help?

- Check existing issues and pull requests
- Review the [README.md](README.md) and code documentation
- Reach out to the team via the project communication channels

## License

By contributing, you agree that your contributions will be licensed under the UNLICENSED license of this project.

---

Thank you for contributing to making the Cheese Admin Dashboard API better!
