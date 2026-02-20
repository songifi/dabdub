# Development Guide

## Getting Started

This guide helps developers understand and work with the blockchain configuration admin system.

## Architecture Overview

### Layered Architecture

```
Controllers
    ↓
Services (Business Logic)
    ↓
Repositories (Data Access)
    ↓
Database
```

### Key Components

1. **Controllers** - HTTP request handling and response formatting
2. **Services** - Business logic, validation, and orchestration
3. **Entities** - TypeORM models representing database tables
4. **DTOs** - Data validation and type safety
5. **Guards/Middleware** - Cross-cutting concerns (auth, logging)

## File Organization

### Controllers (`src/config/controllers/`)

Controllers handle HTTP requests and delegate to services:

```typescript
@Controller('api/v1/config/chains')
export class BlockchainConfigController {
  @Get(':chainId')
  async getChain(@Param('chainId') chainId: string) {
    // Extract user context
    // Call service
    // Format response
  }
}
```

**Responsibilities:**

- Parameter validation
- Request/response formatting
- Error handling and HTTP status codes
- User context extraction

### Services (`src/config/services/`)

Services contain all business logic:

```typescript
@Injectable()
export class BlockchainConfigService {
  async updateChain(chainId: string, updateDto: UpdateChainConfigDto) {
    // Validate business rules
    // Update entity
    // Trigger side effects (events, audit, cache)
  }
}
```

**Responsibilities:**

- Business logic implementation
- Data validation and transformation
- Service integration
- Event publishing
- Audit logging

### Entities (`src/config/entities/`)

TypeORM entities define database schema:

```typescript
@Entity('blockchain_configs')
export class BlockchainConfig extends BaseEntity {
  @Column() chainId: string;
  @Column() displayName: string;
}
```

**Key Points:**

- Decorators define columns and indexes
- Relationships (if needed) use @OneToMany/@ManyToOne
- Timestamps auto-managed by createDate/updateDate

### DTOs (`src/config/dtos/`)

DTOs validate and transform input data:

```typescript
export class UpdateChainConfigDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  requiredConfirmations?: number;
}
```

**Key Points:**

- Use class-validator decorators for validation
- Applied globally via ValidationPipe
- Transform option enables auto-conversion

## Core Services Deep Dive

### BlockchainConfigService

**Flow for updateChain:**

```
1. Find chain by ID
2. Validate business rules
   - Check pending transactions if disabling
   - Log security warnings if sensitive change
3. Prepare change tracking (old vs new values)
4. Save to database
5. Log audit entry
6. Publish chain.config.updated event
7. Invalidate cache
8. Return updated entity
```

**Key Methods:**

- `getAllChains()` - Fetch all with caching
- `getChainById(chainId)` - Fetch with node status
- `updateChain(chainId, updateDto)` - Update with side effects

### TokenConfigService

**Flow for createToken:**

```
1. Validate chain exists
2. Check token uniqueness (chainId + address)
3. Verify token on-chain (RPC call)
   - Fetch symbol() and decimals()
   - Compare with provided values
4. Create token with isEnabled = false
5. Log audit entry
6. Publish token.added event
7. Invalidate cache
8. Return created token
```

**Key Methods:**

- `getAllTokens(filters)` - Fetch with filtering
- `createToken(createDto)` - Create with verification
- `updateToken(id, updateDto)` - Update with audit
- `deleteToken(id)` - Soft-disable with validation

### CacheService

**Cache Operations:**

```
set(key, value, ttl?)
  - Store value with expiration
  - ttl defaults to 300s for chains

get(key)
  - Fetch value or null if expired

del(key)
  - Remove specific key

invalidatePattern(regex)
  - Delete all matching keys
```

**Cache Keys:**

- `chain:{chainId}` - Individual chain
- `chains:all` - All chains list
- `tokens:{chainId}` - Chain tokens
- `tokens:all` - All tokens

### AuditService

**Log Entry Structure:**

```typescript
{
  action: 'CHAIN_CONFIG_UPDATED',
  entityType: 'blockchain_config',
  entityId: '123e4567-e89b-12d3-a456-426614174000',
  description: 'Updated chain config for base',
  changes: {
    old: { requiredConfirmations: 12 },
    new: { requiredConfirmations: 15 }
  },
  userId: 'user-123',
  ipAddress: '192.168.1.1',
  createdAt: '2024-01-15T10:30:00Z'
}
```

### EncryptionService

**Encryption Flow:**

```
encrypt(text)
  - Generate random IV (16 bytes)
  - Create cipher with key + IV
  - Encrypt plaintext
  - Return "iv:encrypted" string

decrypt(encryptedText)
  - Split "iv:encrypted"
  - Create decipher with key + IV
  - Decrypt ciphertext
  - Return plaintext
```

**Security Notes:**

- Key must be 32 bytes (256 bits) for AES-256
- IV randomized each encryption
- Ciphertext includes IV for decryption

## Adding New Features

### Example: Add Chain Creation Endpoint

**1. Create DTO for validation:**

```typescript
// src/config/dtos/create-chain-config.dto.ts
export class CreateChainConfigDto {
  @IsString()
  chainId: string;

  @IsString()
  displayName: string;

  @IsUrl()
  rpcUrl: string;

  @IsInt()
  @Min(1)
  chainIdNumeric: number;
}
```

**2. Add service method:**

```typescript
// In BlockchainConfigService
async createChain(createDto: CreateChainConfigDto): Promise<BlockchainConfig> {
  // Check uniqueness
  const exists = await this.blockchainRepository.findOne({
    where: { chainId: createDto.chainId }
  });

  if (exists) {
    throw new ConflictException(`Chain ${createDto.chainId} already exists`);
  }

  // Encrypt RPC URL
  const encryptedRpcUrl = this.encryptionService.encrypt(createDto.rpcUrl);

  // Create entity
  const chain = this.blockchainRepository.create({
    ...createDto,
    rpcUrl: encryptedRpcUrl
  });

  const saved = await this.blockchainRepository.save(chain);

  // Audit
  await this.auditService.log('CHAIN_ADDED', 'blockchain_config', saved.id, ...);

  // Event
  await this.eventService.publishChainCreated(saved);

  // Cache
  await this.cacheService.del(this.cacheService.getChainListKey());

  return saved;
}
```

**3. Add controller endpoint:**

```typescript
// In BlockchainConfigController
@Post()
@HttpCode(HttpStatus.CREATED)
async createChain(@Body() createDto: CreateChainConfigDto, @Req() req: Request) {
  const chain = await this.blockchainConfigService.createChain(createDto);
  return {
    success: true,
    data: chain,
    message: 'Chain created successfully'
  };
}
```

**4. Add tests:**

```typescript
// src/config/services/blockchain-config.service.spec.ts
describe('createChain', () => {
  it('should create a new chain', async () => {
    const createDto = {
      chainId: 'optimism',
      displayName: 'Optimism',
      rpcUrl: 'https://mainnet.optimism.io',
      chainIdNumeric: 10,
    };

    const result = await service.createChain(createDto);

    expect(result).toBeDefined();
    expect(result.chainId).toBe('optimism');
    expect(mockAuditService.log).toHaveBeenCalled();
  });
});
```

## Testing Guidelines

### Unit Tests

```typescript
describe('BlockchainConfigService', () => {
  let service: BlockchainConfigService;
  let mockRepository: any;

  beforeEach(async () => {
    // Setup mocks
    mockRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    // Create test module
    const module = await Test.createTestingModule({
      providers: [
        BlockchainConfigService,
        { provide: getRepositoryToken(BlockchainConfig), useValue: mockRepository },
      ],
    }).compile();

    service = module.get(BlockchainConfigService);
  });

  it('should handle business logic correctly', async () => {
    // Arrange
    mockRepository.findOne.mockResolvedValueOnce(mockChain);

    // Act
    const result = await service.getChainById('base');

    // Assert
    expect(result).toBeDefined();
    expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { chainId: 'base' } });
  });
});
```

### E2E Tests

```typescript
describe('Chain Endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET /api/v1/config/chains', () => {
    return request(app.getHttpServer())
      .get('/api/v1/config/chains')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('success');
        expect(res.body).toHaveProperty('data');
      });
  });
});
```

## Database Migrations

For production, use TypeORM migrations:

```bash
# Generate migration from current entities
npm run typeorm migration:generate -- src/migrations/InitialSchema

# Run migrations
npm run typeorm migration:run

# Revert migration
npm run typeorm migration:revert
```

## Performance Optimization Tips

### Query Optimization

```typescript
// ❌ Bad: N+1 query
const chains = await this.blockchainRepository.find();
for (const chain of chains) {
  chain.tokens = await this.tokenRepository.find({ where: { chainId: chain.chainId } });
}

// ✅ Good: Single query with join
const chains = await this.blockchainRepository.find({
  relations: ['tokens'],
});
```

### Caching Strategy

```typescript
// ❌ Bad: No caching
async getAllChains() {
  return this.blockchainRepository.find();
}

// ✅ Good: With cache
async getAllChains() {
  const cached = await this.cacheService.get('chains:all');
  if (cached) return cached;

  const chains = await this.blockchainRepository.find();
  await this.cacheService.set('chains:all', chains, 30000);
  return chains;
}
```

### Batch Operations

```typescript
// ✅ Good: Batch update
const updates = chains.map((chain) => ({ ...chain, isEnabled: false }));
await this.blockchainRepository.save(updates); // Single query
```

## Debugging

### Enable Debug Logging

```bash
# Set environment variable
export DEBUG=nestjs:*

# Or run with debug flag
npm run start:debug
```

### Inspect Database

```bash
# Connect to PostgreSQL
psql -U postgres -d blockchain_config

# View tables
\dt

# Query data
SELECT * FROM blockchain_configs;

# View recent audit logs
SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT 10;
```

### Trace Requests

```typescript
// Add logging middleware
@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - start;
      this.logger.debug(`${method} ${originalUrl} ${statusCode} - ${duration}ms`);
    });

    next();
  }
}
```

## Code Style Guide

### Naming Conventions

```typescript
// Services: *.service.ts
export class ChainService {}

// Controllers: *.controller.ts
export class ChainController {}

// Entities: *.entity.ts
export class Chain {}

// DTOs: *-*.dto.ts
export class CreateChainDto {}

// Test files: *.spec.ts
describe('ChainService', () => {});
```

### Function Naming

```typescript
// Getters: get*, fetch*
async getChainById(id: string)
async fetchChains()

// Setters: set*, create*, update*
async setChainStatus(id: string, enabled: boolean)
async createChain(dto: CreateChainDto)
async updateChain(id: string, dto: UpdateChainDto)

// Checkers: is*, has*, check*
private checkPendingTransactions(chainId: string): boolean
async isChainHealthy(chainId: string): Promise<boolean>

// Handlers: handle*, on*
onChainConfigUpdated(event: ChainConfigUpdatedEvent)
```

### Error Handling

```typescript
// ✅ Good: Specific exceptions with context
if (!chain) {
  throw new NotFoundException(`Chain with id ${chainId} not found`);
}

// ✅ Good: Input validation
if (dto.requiredConfirmations < 1) {
  throw new BadRequestException('requiredConfirmations must be >= 1');
}

// ❌ Bad: Generic errors
throw new Error('Not found');
throw new Error('Invalid input');
```

## Common Patterns

### Service Injection Pattern

```typescript
@Injectable()
export class ChainService {
  constructor(
    @InjectRepository(Chain)
    private readonly chainRepository: Repository<Chain>,
    private readonly cacheService: CacheService,
    private readonly auditService: AuditService,
    private readonly eventService: EventService
  ) {}
}
```

### Audit Logging Pattern

```typescript
await this.auditService.log(
  'ACTION_TYPE',
  'entity_type',
  entityId,
  'Human readable description',
  { old: oldValue, new: newValue },
  userId,
  ipAddress
);
```

### Cache Invalidation Pattern

```typescript
// Invalidate specific cache
await this.cacheService.del(this.cacheService.getChainKey(chainId));

// Invalidate related caches
await this.cacheService.invalidatePattern('chain:.*');

// Cascade invalidation
await this.cacheService.del(this.cacheService.getChainListKey());
```

### Event Publishing Pattern

```typescript
await this.eventService.publishChainConfigUpdated({
  chainId: dto.chainId,
  changes: updatedValues,
  timestamp: new Date(),
});
```

## Resources

- [NestJS Docs](https://docs.nestjs.com/)
- [TypeORM Docs](https://typeorm.io/)
- [class-validator](https://github.com/typestack/class-validator)
- [Jest Testing](https://jestjs.io/)

## Contributing

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes following code style guide
3. Add tests for new functionality
4. Run tests: `npm run test`
5. Format code: `npm run format`
6. Create pull request

## Questions?

Review the code examples in `src/config/services/` and `src/config/controllers/` for reference implementations.
