import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { SandboxService } from './sandbox.service';
import type { SandboxRequest } from './types/sandbox-request.type';

@Injectable()
export class SandboxApiKeyGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly sandboxService: SandboxService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<SandboxRequest & { headers: Record<string, string | string[] | undefined> }>();

    if (req.headers.authorization) {
      throw new ForbiddenException('Sandbox endpoints require API key auth only');
    }

    const apiKeyHeader = req.headers['x-api-key'];
    const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;

    if (!apiKey) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    if (apiKey.startsWith('ck_live_')) {
      throw new ForbiddenException('Live API keys cannot access sandbox endpoints');
    }

    if (!this.sandboxService.isSandboxRequest(apiKey)) {
      throw new UnauthorizedException('Sandbox API key must start with ck_test_');
    }

    const merchantId = this.sandboxService.extractMerchantIdFromApiKey(apiKey);
    if (!merchantId) {
      throw new UnauthorizedException(
        'Sandbox API key must include a merchant UUID (ck_test_<merchantUserId>...)',
      );
    }

    const merchantUser = await this.userRepo.findOne({ where: { id: merchantId } });
    if (!merchantUser || !merchantUser.isMerchant) {
      throw new UnauthorizedException('Sandbox API key is not linked to a merchant user');
    }

    req.sandboxAuth = {
      apiKey,
      merchantId,
      sandbox: true,
    };

    return true;
  }
}
