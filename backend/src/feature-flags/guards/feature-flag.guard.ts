import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '../../users/entities/user.entity';
import { FeatureFlagService } from '../feature-flag.service';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!key) return true;

    const req = context.switchToHttp().getRequest<{ user?: User }>();
    const user = req.user;
    if (!user || !('tier' in user)) {
      throw new NotFoundException();
    }

    const enabled = await this.featureFlags.isEnabled(key, user.id, user.tier);
    if (!enabled) {
      throw new NotFoundException();
    }
    return true;
  }
}
