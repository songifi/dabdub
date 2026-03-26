import { Test } from '@nestjs/testing';
import {
  INestApplication,
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import request from 'supertest';
import { Reflector } from '@nestjs/core';
import { Roles } from './decorators/roles.decorator';
import { Permissions } from './decorators/permissions.decorator';
import { Role, Permission } from './rbac.types';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminPermission } from './entities/admin-permission.entity';
import { redisConfig } from '../config/redis.config';

const redisStore = new Map<string, string>();
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(async (k: string) => redisStore.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => {
      redisStore.set(k, v);
      return 'OK';
    }),
    del: jest.fn(async (k: string) => {
      redisStore.delete(k);
      return 1;
    }),
    on: jest.fn(),
  }));
});

@Controller('admin/test')
@UseGuards(RolesGuard)
@Roles(Role.Admin)
class AdminOnlyController {
  @Get()
  ok(): { ok: true } {
    return { ok: true };
  }
}

@Controller('admin/kyc')
@UseGuards(RolesGuard, PermissionsGuard)
class TestKycController {
  @Patch(':id/approve')
  @Roles(Role.Admin)
  @Permissions(Permission.KycReview)
  approve(@Param('id') id: string): { ok: true; id: string } {
    return { ok: true, id };
  }
}

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<any>();
    const role = (req.headers['x-test-role'] as string | undefined) ?? 'user';
    const userId =
      (req.headers['x-test-user-id'] as string | undefined) ?? 'u1';
    req.user = { id: userId, role };
    return true;
  }
}

describe('RBAC guards (route-level)', () => {
  let app: INestApplication;
  const permRepo = { find: jest.fn() };

  beforeEach(() => {
    redisStore.clear();
    permRepo.find.mockReset();
  });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [AdminOnlyController, TestKycController],
      providers: [
        Reflector,
        RolesGuard,
        PermissionsGuard,
        { provide: getRepositoryToken(AdminPermission), useValue: permRepo },
        {
          provide: redisConfig.KEY,
          useValue: { host: 'localhost', port: 6379, password: undefined },
        },
      ],
    })
      .overrideGuard(RolesGuard)
      .useClass(RolesGuard)
      .compile();

    app = mod.createNestApplication();
    app.useGlobalGuards(new TestAuthGuard());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('User → /admin/* → 403', async () => {
    await request(app.getHttpServer())
      .get('/admin/test')
      .set('x-test-role', Role.User)
      .expect(403);
  });

  it('Admin without kyc.review → PATCH /admin/kyc/:id/approve → 403', async () => {
    permRepo.find.mockResolvedValueOnce([]);

    await request(app.getHttpServer())
      .patch('/admin/kyc/kyc1/approve')
      .set('x-test-role', Role.Admin)
      .set('x-test-user-id', 'admin1')
      .expect(403);
  });

  it('Admin with kyc.review → PATCH /admin/kyc/:id/approve → 200', async () => {
    permRepo.find.mockResolvedValueOnce([{ permission: Permission.KycReview }]);

    await request(app.getHttpServer())
      .patch('/admin/kyc/kyc2/approve')
      .set('x-test-role', Role.Admin)
      .set('x-test-user-id', 'admin1')
      .expect(200);
  });
});
