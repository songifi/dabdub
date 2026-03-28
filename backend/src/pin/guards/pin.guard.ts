import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Admin } from '../../admin/entities/admin.entity';
import { REQUIRE_PIN_KEY } from '../decorators/require-pin.decorator';
import { PinInvalidException } from '../exceptions/pin-invalid.exception';
import { PinService } from '../pin.service';

type AuthRequest = Request & { user: unknown };

@Injectable()
export class PinGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly pinService: PinService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirePin = this.reflector.getAllAndOverride<boolean>(REQUIRE_PIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requirePin) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthRequest>();
    const user = req.user;
    if (user instanceof Admin) {
      throw new PinInvalidException();
    }
    if (typeof user !== 'object' || user === null || !('id' in user)) {
      throw new PinInvalidException();
    }
    const userId = (user as { id: string }).id;

    const raw = req.headers['x-transaction-pin'];
    const headerPin = Array.isArray(raw) ? raw[0] : raw;
    await this.pinService.verifyPin(userId, headerPin ?? '');
    return true;
  }
}
