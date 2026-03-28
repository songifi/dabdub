import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import type { ConfigType } from '@nestjs/config';
import { redisConfig } from '../../config/redis.config';
import { AdminPermission } from '../entities/admin-permission.entity';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import type { Permission } from '../rbac.types';

const TTL_SECONDS = 60;
const cacheKey = (adminId: string) => `rbac:admin-permissions:${adminId}`;

type RequestWithUser = { user?: { id?: string } };

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly redis: Redis;

  constructor(
    private readonly reflector: Reflector,

    @InjectRepository(AdminPermission)
    private readonly permRepo: Repository<AdminPermission>,

    @Inject(redisConfig.KEY)
    redisCfg: ConfigType<typeof redisConfig>,
  ) {
    this.redis = new Redis({
      host: redisCfg.host,
      port: redisCfg.port,
      password: redisCfg.password,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const adminId = req.user?.id;
    if (!adminId) throw new ForbiddenException('Missing user');

    const perms = await this.getPermissions(adminId);
    const allowed = required.every((p) => perms.includes(p));
    if (!allowed) throw new ForbiddenException('Missing permission');
    return true;
  }

  async invalidate(adminId: string): Promise<void> {
    await this.redis.del(cacheKey(adminId));
  }

  private async getPermissions(adminId: string): Promise<Permission[]> {
    const cached = await this.redis.get(cacheKey(adminId));
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as Permission[];
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fall through
      }
    }

    const rows = await this.permRepo.find({
      where: { adminId },
    });
    const perms = rows.map((r) => r.permission);
    await this.redis.set(
      cacheKey(adminId),
      JSON.stringify(perms),
      'EX',
      TTL_SECONDS,
    );
    return perms;
  }
}
