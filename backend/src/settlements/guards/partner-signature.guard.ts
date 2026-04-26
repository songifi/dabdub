import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class PartnerSignatureGuard implements CanActivate {
  private readonly logger = new Logger(PartnerSignatureGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const signature = req.headers['x-partner-signature'] as string | undefined;

    if (!signature) {
      this.logger.warn('[SECURITY] Partner callback missing X-Partner-Signature header', {
        ip: req.ip,
        path: req.path,
      });
      throw new ForbiddenException('Missing signature');
    }

    const secret = this.config.get<string>('PARTNER_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.error('[SECURITY] PARTNER_WEBHOOK_SECRET is not configured');
      throw new ForbiddenException('Signature verification unavailable');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      this.logger.error('[SECURITY] Raw body unavailable for signature verification');
      throw new ForbiddenException('Signature verification unavailable');
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    let valid = false;
    try {
      const expectedBuf = Buffer.from(expected, 'hex');
      const receivedBuf = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
      valid =
        expectedBuf.length === receivedBuf.length &&
        timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      valid = false;
    }

    if (!valid) {
      this.logger.warn('[SECURITY] Partner callback signature mismatch — possible forgery', {
        ip: req.ip,
        path: req.path,
        receivedSignature: signature,
      });
      throw new ForbiddenException('Invalid signature');
    }

    return true;
  }
}
