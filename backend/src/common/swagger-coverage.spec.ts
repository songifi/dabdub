/**
 * Swagger coverage guard.
 *
 * Verifies:
 *  1. Every controller method has an @ApiOperation decorator.
 *  2. Every exported DTO class has @ApiProperty on every own property.
 *
 * All service/infrastructure imports are mocked so this test is purely
 * a reflection-based metadata check — no NestJS DI container is started.
 */
import 'reflect-metadata';
import { DECORATORS } from '@nestjs/swagger/dist/constants';

// ── Blanket mocks for all infrastructure that isn't installed ─────────────────
jest.mock('@nestjs-modules/ioredis', () => ({ InjectRedis: () => () => {} }), { virtual: true });
jest.mock('qrcode', () => ({}), { virtual: true });
jest.mock('../paylink/entities/pay-link.entity', () => ({ PayLink: class {} }), { virtual: true });
jest.mock('@nestjs/websockets', () => ({ WebSocketGateway: () => () => {}, WebSocketServer: () => () => {} }), { virtual: true });
jest.mock('socket.io', () => ({}), { virtual: true });
jest.mock('@nestjs/config', () => ({
  ConfigService: class {},
  ConfigModule: { forRoot: () => ({}) },
  registerAs: (_token: string, fn: () => unknown) => fn,
}));
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => {},
  TypeOrmModule: { forFeature: () => ({}), forRootAsync: () => ({}) },
  getRepositoryToken: () => 'REPO',
}));
jest.mock('typeorm', () => {
  const noop = () => () => {};
  return {
    Entity: noop, Column: noop, ManyToOne: noop, JoinColumn: noop,
    PrimaryGeneratedColumn: noop, CreateDateColumn: noop, UpdateDateColumn: noop,
    Index: noop, BeforeInsert: noop, BeforeUpdate: noop,
    DataSource: class {}, Repository: class {},
  };
});
jest.mock('@nestjs/jwt', () => ({
  JwtService: class {},
  JwtModule: { registerAsync: () => ({}) },
}));
jest.mock('@nestjs/passport', () => ({
  PassportModule: { register: () => ({}) },
  PassportStrategy: (Base: any) => class extends (Base ?? class {}) {},
  AuthGuard: () => class {},
}));
jest.mock('passport-jwt', () => ({ Strategy: class {}, ExtractJwt: { fromAuthHeaderAsBearerToken: () => {} } }));
jest.mock('bcrypt', () => ({ hash: async () => '', compare: async () => true }));
jest.mock('@nestjs/bull', () => ({
  InjectQueue: () => () => {},
  BullModule: { registerQueue: () => ({}) },
  Process: () => () => {},
  Processor: () => () => {},
}));
jest.mock('bull', () => ({ Queue: class {} }));
jest.mock('@nestjs/terminus', () => ({
  HealthCheckService: class {},
  TypeOrmHealthIndicator: class {},
  HealthIndicator: class {},
  HealthCheck: () => () => {},
  TerminusModule: {},
}));
jest.mock('@nestjs/throttler', () => ({
  ThrottlerGuard: class {},
  ThrottlerModule: { forRootAsync: () => ({}) },
  ThrottlerException: class extends Error {},
  Throttle: () => () => {},
  SkipThrottle: () => () => {},
}));

// ── Controllers ───────────────────────────────────────────────────────────────
import { AuthController } from '../auth/auth.controller';
import { FraudAdminController } from '../fraud/fraud-admin.controller';
import { QrController } from '../qr/qr.controller';
import { LeaderboardController } from '../leaderboard/leaderboard.controller';
import { RateLimitAdminController } from '../rate-limit/rate-limit-admin.controller';
import { HealthController } from '../health/health.controller';

// ── DTOs ──────────────────────────────────────────────────────────────────────
import { RegisterDto } from '../auth/dto/register.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { RefreshDto } from '../auth/dto/refresh.dto';
import { TokenResponseDto } from '../auth/dto/token-response.dto';
import { QueryFlagsDto } from '../fraud/dto/query-flags.dto';
import { ResolveFlagDto } from '../fraud/dto/resolve-flag.dto';
import { QrResponseDto } from '../qr/dto/qr-response.dto';
import { UserQrQueryDto } from '../qr/dto/user-qr-query.dto';
import { LeaderboardEntryDto } from '../leaderboard/dto/leaderboard-entry.dto';
import { LeaderboardResponseDto } from '../leaderboard/dto/leaderboard-response.dto';

// ─────────────────────────────────────────────────────────────────────────────

const CONTROLLERS = [
  AuthController,
  FraudAdminController,
  QrController,
  LeaderboardController,
  RateLimitAdminController,
  HealthController,
];

const DTOS: Array<new () => object> = [
  RegisterDto,
  LoginDto,
  RefreshDto,
  TokenResponseDto,
  QueryFlagsDto,
  ResolveFlagDto,
  QrResponseDto,
  UserQrQueryDto,
  LeaderboardEntryDto,
  LeaderboardResponseDto,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHttpMethods(proto: object): string[] {
  return Object.getOwnPropertyNames(proto).filter((key) => {
    if (key === 'constructor') return false;
    const descriptor = Object.getOwnPropertyDescriptor(proto, key);
    return descriptor && typeof descriptor.value === 'function';
  });
}

function hasApiOperation(target: object, methodName: string): boolean {
  const meta = Reflect.getMetadata(
    DECORATORS.API_OPERATION,
    (target as any).prototype[methodName],
  );
  return !!meta;
}

function getSwaggerProperties(target: new () => object): string[] {
  const meta = Reflect.getMetadata(
    DECORATORS.API_MODEL_PROPERTIES_ARRAY,
    new target(),
  );
  if (!meta) return [];
  return ((meta as unknown) as string[]).map((k: string) => k.replace(/^:/, ''));
}

function getOwnProperties(target: new () => object): string[] {
  const instance = new target();
  const protoKeys = Object.getOwnPropertyNames(
    Object.getPrototypeOf(instance),
  ).filter((k) => k !== 'constructor');
  const instanceKeys = Object.getOwnPropertyNames(instance);
  return [...new Set([...protoKeys, ...instanceKeys])];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Swagger coverage', () => {
  describe('@ApiOperation on every controller method', () => {
    for (const Controller of CONTROLLERS) {
      const methods = getHttpMethods(Controller.prototype);
      for (const method of methods) {
        it(`${Controller.name}#${method} has @ApiOperation`, () => {
          expect(hasApiOperation(Controller, method)).toBe(true);
        });
      }
    }
  });

  describe('@ApiProperty on every DTO field', () => {
    for (const Dto of DTOS) {
      it(`${Dto.name} — all own properties are decorated`, () => {
        const decorated = getSwaggerProperties(Dto);
        const own = getOwnProperties(Dto);

        const missing = own.filter(
          (p) => typeof (Dto.prototype as any)[p] !== 'function' && !decorated.includes(p),
        );

        expect(missing).toEqual([]);
      });
    }
  });
});
