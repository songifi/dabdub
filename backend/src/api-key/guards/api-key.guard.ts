import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from '../api-key.service';
import { RedisService } from '../../common/redis/redis.service';
import { RedisKeys } from '../../common/redis/redis-keys';

const FAILED_ATTEMPTS_LIMIT = 5;
const FAILED_ATTEMPTS_TTL_SEC = 60;

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private apiKeyService: ApiKeyService,
    private reflector: Reflector,
    @Optional() private redis: RedisService | null,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const clientIp = request.ip || request.connection?.remoteAddress || '0.0.0.0';

    if (!apiKey) throw new UnauthorizedException('Missing API Key');

    const keyEntity = await this.apiKeyService.validateKey(apiKey);
    if (!keyEntity) {
      await this.recordFailedAttempt(clientIp);
      const count = await this.getFailedAttemptCount(clientIp);
      if (count >= FAILED_ATTEMPTS_LIMIT) {
        throw new HttpException(
          'Too many failed API key attempts. Try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new UnauthorizedException('Invalid API Key');
    }

    // 1. IP Whitelist Check
    if (
      keyEntity.ipWhitelist.length > 0 &&
      !keyEntity.ipWhitelist.includes(clientIp)
    ) {
      throw new ForbiddenException(`IP ${clientIp} not whitelisted`);
    }

    // 2. Scope Check (via Decorator)
    const requiredScopes = this.reflector.get<string[]>(
      'scopes',
      context.getHandler(),
    );
    if (
      requiredScopes &&
      !requiredScopes.every((s) => keyEntity.scopes.includes(s))
    ) {
      throw new ForbiddenException('Insufficient API key permissions');
    }

    request['apiKeyMetadata'] = keyEntity;
    return true;
  }

  private async recordFailedAttempt(ip: string): Promise<void> {
    if (!this.redis?.client) return;
    const key = RedisKeys.apiKeyFailedAttempts(ip);
    const client = this.redis.client;
    const n = await client.incr(key);
    if (n === 1) await client.expire(key, FAILED_ATTEMPTS_TTL_SEC);
  }

  private async getFailedAttemptCount(ip: string): Promise<number> {
    if (!this.redis?.client) return 0;
    const raw = await this.redis.client.get(RedisKeys.apiKeyFailedAttempts(ip));
    return raw ? parseInt(raw, 10) : 0;
  }
}
