import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

function ipInCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) return ip === cidr;

  const [range, bits] = cidr.split('/');
  const mask = ~((1 << (32 - parseInt(bits, 10))) - 1) >>> 0;

  const toInt = (addr: string) =>
    addr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;

  try {
    return (toInt(ip) & mask) === (toInt(range) & mask);
  } catch {
    return false;
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip ?? '';
}

@Injectable()
export class IpAllowlistGuard implements CanActivate {
  private readonly logger = new Logger(IpAllowlistGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const isDev = this.config.get<string>('NODE_ENV') === 'development';
    const bypassInDev = this.config.get<string>('ADMIN_IP_BYPASS_IN_DEV') === 'true';

    if (isDev && bypassInDev) return true;

    const raw = this.config.get<string>('ADMIN_ALLOWED_IPS', '');
    const allowedEntries = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const req = context.switchToHttp().getRequest<Request>();
    const clientIp = getClientIp(req);

    if (allowedEntries.length === 0 || !allowedEntries.some((entry) => ipInCidr(clientIp, entry))) {
      this.logger.warn(
        `[Security] Blocked admin access from IP=${clientIp} ${req.method} ${req.originalUrl}`,
      );
      throw new ForbiddenException('Access denied: IP not in allowlist');
    }

    return true;
  }
}
