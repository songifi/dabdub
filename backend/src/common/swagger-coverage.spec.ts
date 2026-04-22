/**
 * Swagger coverage guard.
 *
 * Verifies:
 *  1. Every controller method has an @ApiOperation decorator.
 *  2. Every controller method has at least one @Api*Response (same metadata as @ApiResponse).
 *  3. Every exported DTO class has @ApiProperty / @ApiPropertyOptional on every own property.
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
// ── Controllers (every HTTP controller under src/) ────────────────────────────
import { AuthController } from '../auth/auth.controller';
import { FraudAdminController } from '../fraud/fraud-admin.controller';
import { QrController } from '../qr/qr.controller';
import { LeaderboardController } from '../leaderboard/leaderboard.controller';
import { RateLimitAdminController } from '../rate-limit/rate-limit-admin.controller';
import { HealthController } from '../health/health.controller';
import { NotificationsController } from '../notifications/notifications.controller';
import { WebhooksController } from '../webhooks/webhooks.controller';
import { AdminKycController } from '../rbac/admin-kyc.controller';
import { AdminPermissionsController } from '../rbac/admin-permissions.controller';
import { WsAdminController } from '../ws/ws-admin.controller';
import { RatesController } from '../rates/rates.controller';
import { TierController } from '../tier-config/tier.controller';
import { VirtualAccountController } from '../virtual-account/virtual-account.controller';
import { UploadController } from '../uploads/upload.controller';
import { EmailAdminController } from '../email/email-admin.controller';

// ── DTOs & API schema classes ─────────────────────────────────────────────────
import { RegisterDto } from '../auth/dto/register.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { RefreshDto } from '../auth/dto/refresh.dto';
import { TokenResponseDto } from '../auth/dto/token-response.dto';
import { QueryFlagsDto } from '../fraud/dto/query-flags.dto';
import { ResolveFlagDto } from '../fraud/dto/resolve-flag.dto';
import { FraudFlagResponseDto } from '../fraud/dto/fraud-flag-response.dto';
import { FraudFlagsListResponseDto } from '../fraud/dto/fraud-flags-list-response.dto';
import { QrResponseDto } from '../qr/dto/qr-response.dto';
import { UserQrQueryDto } from '../qr/dto/user-qr-query.dto';
import { QrUserResponseDto } from '../qr/dto/qr-user-response.dto';
import { LeaderboardEntryDto } from '../leaderboard/dto/leaderboard-entry.dto';
import { LeaderboardResponseDto } from '../leaderboard/dto/leaderboard-response.dto';
import { GetNotificationsQueryDto } from '../notifications/dto/get-notifications.query';
import {
  NotificationResponseDto,
  NotificationsListResponseDto,
  UnreadCountResponseDto,
} from '../notifications/dto/notification-response.dto';
import { CreateWebhookDto } from '../webhooks/dto/create-webhook.dto';
import { RedeliverWebhookDto } from '../webhooks/dto/redeliver-webhook.dto';
import {
  CreateWebhookResponseDto,
  RedeliverResponseDto,
  WebhookSubscriptionResponseDto,
} from '../webhooks/dto/webhook-subscription-response.dto';
import { WebhookDeliveryResponseDto } from '../webhooks/dto/webhook-delivery-response.dto';
import { GrantPermissionDto } from '../rbac/dto/grant-permission.dto';
import {
  AdminPermissionsListResponseDto,
  KycApproveResponseDto,
  OkResponseDto,
} from '../rbac/dto/rbac-api-response.dto';
import { WsStatsResponseDto } from '../ws/dto/ws-stats-response.dto';
import { BlockedIpsResponseDto, UnblockIpResponseDto } from '../rate-limit/dto/rate-limit-admin-response.dto';
import { HealthCheckResponseDto } from '../health/dto/health-check-response.dto';
import { RateQuoteResponseDto } from '../rates/dto/rate-quote-response.dto';
import { TierConfigResponseDto } from '../tier-config/dto/tier-config-response.dto';
import { UserTierUpdateResponseDto } from '../tier-config/dto/user-tier-update-response.dto';
import { UpdateUserTierDto } from '../tier-config/dto/update-user-tier.dto';
import { VirtualAccountResponseDto } from '../virtual-account/dto/virtual-account-response.dto';
import { VirtualAccountWebhookAckDto } from '../virtual-account/dto/virtual-account-webhook-ack.dto';
import { PresignDto } from '../uploads/dto/presign.dto';
import { ConfirmUploadDto } from '../uploads/dto/confirm-upload.dto';
import { PresignResponseDto } from '../uploads/dto/presign-response.dto';
import { FileUploadResponseDto } from '../uploads/dto/file-upload-response.dto';
import { TestEmailDto } from '../email/dto/test-email.dto';
import { ZeptoSendResultDto } from '../email/dto/zepto-send-result.dto';

// ─────────────────────────────────────────────────────────────────────────────

const CONTROLLERS = [
  AuthController,
  FraudAdminController,
  QrController,
  LeaderboardController,
  RateLimitAdminController,
  HealthController,
  NotificationsController,
  WebhooksController,
  AdminKycController,
  AdminPermissionsController,
  WsAdminController,
  RatesController,
  TierController,
  VirtualAccountController,
  UploadController,
  EmailAdminController,
];

const DTOS: Array<new () => object> = [
  RegisterDto,
  LoginDto,
  RefreshDto,
  TokenResponseDto,
  QueryFlagsDto,
  ResolveFlagDto,
  FraudFlagResponseDto,
  FraudFlagsListResponseDto,
  QrResponseDto,
  UserQrQueryDto,
  QrUserResponseDto,
  LeaderboardEntryDto,
  LeaderboardResponseDto,
  GetNotificationsQueryDto,
  NotificationResponseDto,
  NotificationsListResponseDto,
  UnreadCountResponseDto,
  CreateWebhookDto,
  RedeliverWebhookDto,
  WebhookSubscriptionResponseDto,
  CreateWebhookResponseDto,
  RedeliverResponseDto,
  WebhookDeliveryResponseDto,
  GrantPermissionDto,
  OkResponseDto,
  AdminPermissionsListResponseDto,
  KycApproveResponseDto,
  WsStatsResponseDto,
  BlockedIpsResponseDto,
  UnblockIpResponseDto,
  HealthCheckResponseDto,
  RateQuoteResponseDto,
  TierConfigResponseDto,
  UserTierUpdateResponseDto,
  UpdateUserTierDto,
  VirtualAccountResponseDto,
  VirtualAccountWebhookAckDto,
  PresignDto,
  ConfirmUploadDto,
  PresignResponseDto,
  FileUploadResponseDto,
  TestEmailDto,
  ZeptoSendResultDto,
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

function hasApiResponseMetadata(target: object, methodName: string): boolean {
  const meta = Reflect.getMetadata(
    DECORATORS.API_RESPONSE,
    (target as any).prototype[methodName],
  );
  return meta != null && typeof meta === 'object' && Object.keys(meta).length > 0;
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

  describe('@Api*Response metadata on every controller method', () => {
    for (const Controller of CONTROLLERS) {
      const methods = getHttpMethods(Controller.prototype);
      for (const method of methods) {
        it(`${Controller.name}#${method} documents HTTP responses`, () => {
          expect(hasApiResponseMetadata(Controller, method)).toBe(true);
        });
      }
    }
  });

  describe('@ApiProperty / @ApiPropertyOptional on every DTO field', () => {
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
