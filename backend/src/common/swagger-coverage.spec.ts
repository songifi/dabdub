/**
 * Swagger coverage: @ApiOperation + @Api*Response on every HTTP controller method;
 * DTO fields decorated with @ApiProperty / @ApiPropertyOptional.
 */
import 'reflect-metadata';
import { DECORATORS } from '@nestjs/swagger/dist/constants';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => {},
  TypeOrmModule: { forFeature: () => ({}) },
  getRepositoryToken: () => 'REPO',
}));
jest.mock('typeorm', () => {
  const noop = () => () => {};
  return {
    Entity: noop,
    Column: noop,
    PrimaryGeneratedColumn: noop,
    CreateDateColumn: noop,
    UpdateDateColumn: noop,
    OneToMany: noop,
    ManyToOne: noop,
    JoinColumn: noop,
    Repository: class {},
  };
});
jest.mock('@nestjs/jwt', () => ({
  JwtService: class {},
  JwtModule: { registerAsync: () => ({}) },
}));
jest.mock('@nestjs/passport', () => ({
  PassportModule: { register: () => ({}) },
  PassportStrategy: (Base: unknown) => class extends (Base as any) {},
  AuthGuard: () => class {},
}));
jest.mock('passport-jwt', () => ({
  Strategy: class {},
  ExtractJwt: { fromAuthHeaderAsBearerToken: () => () => {} },
}));
jest.mock('bcrypt', () => ({ hash: async () => '', compare: async () => true }));

import { AuthController } from '../auth/auth.controller';
import { MerchantsController } from '../merchants/merchants.controller';
import { PaymentsController, PublicPaymentController } from '../payments/payments.controller';
import { SettlementsController } from '../settlements/settlements.controller';
import { WaitlistController } from '../waitlist/waitlist.controller';
import { WebhooksController } from '../webhooks/webhooks.controller';

import { RegisterDto } from '../auth/dto/register.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { AuthTokenResponseDto } from '../auth/dto/auth-token-response.dto';
import { UpdateMerchantDto } from '../merchants/dto/create-merchant.dto';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';
import { JoinWaitlistDto } from '../waitlist/dto/join-waitlist.dto';
import { UsernameAvailabilityDto, WaitlistStatsDto } from '../waitlist/dto/waitlist-response.dto';
import { CreateWebhookDto } from '../webhooks/dto/create-webhook.dto';

const CONTROLLERS = [
  AuthController,
  MerchantsController,
  PaymentsController,
  PublicPaymentController,
  SettlementsController,
  WaitlistController,
  WebhooksController,
];

const DTOS: Array<new () => object> = [
  RegisterDto,
  LoginDto,
  AuthTokenResponseDto,
  UpdateMerchantDto,
  CreatePaymentDto,
  JoinWaitlistDto,
  UsernameAvailabilityDto,
  WaitlistStatsDto,
  CreateWebhookDto,
];

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
