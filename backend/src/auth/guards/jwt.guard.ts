import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const rawKey = req.headers['x-api-key'];
    if (typeof rawKey === 'string' && rawKey.trim().length > 0) {
      const merchant = await this.authService.findMerchantByApiKey(rawKey.trim());
      if (!merchant) {
        throw new UnauthorizedException('Invalid API key');
      }
      req.user = {
        merchantId: merchant.id,
        email: merchant.email,
        role: merchant.role,
      };
      return true;
    }
    return (await super.canActivate(context)) as boolean;
  }
}
