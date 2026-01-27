import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { ApiKeyService } from '../api-key.service';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private apiKeyService: ApiKeyService,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) throw new UnauthorizedException('Missing API Key');

    const keyEntity = await this.apiKeyService.validateKey(apiKey);
    if (!keyEntity) throw new UnauthorizedException('Invalid API Key');

    // 1. IP Whitelist Check
    const clientIp = request.ip;
    if (keyEntity.ipWhitelist.length > 0 && !keyEntity.ipWhitelist.includes(clientIp)) {
      throw new ForbiddenException(`IP ${clientIp} not whitelisted`);
    }

    // 2. Scope Check (via Decorator)
    const requiredScopes = this.reflector.get<string[]>('scopes', context.getHandler());
    if (requiredScopes && !requiredScopes.every(s => keyEntity.scopes.includes(s))) {
      throw new ForbiddenException('Insufficient API key permissions');
    }

    request['apiKeyMetadata'] = keyEntity;
    return true;
  }
}