import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class MetricsGuard implements CanActivate {
  private readonly logger = new Logger(MetricsGuard.name);
  private readonly allowedIps: Set<string>;
  private readonly allowedNetworks: { start: bigint; end: bigint }[];

  constructor() {
    const raw =
      process.env['METRICS_ALLOWLIST_IPS'] ??
      '127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16';

    this.allowedIps = new Set();
    this.allowedNetworks = [];

    for (const entry of raw.split(',').map((s) => s.trim())) {
      if (!entry) continue;
      if (entry.includes('/')) {
        const network = this.parseCidr(entry);
        if (network) this.allowedNetworks.push(network);
      } else {
        this.allowedIps.add(entry);
      }
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = this.extractClientIp(req);

    if (this.isAllowed(ip)) {
      return true;
    }

    this.logger.warn(`Metrics access denied for IP: ${ip}`);
    return false;
  }

  private extractClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress ?? req.ip ?? 'unknown';
  }

  private isAllowed(ip: string): boolean {
    if (this.allowedIps.has(ip)) return true;

    const ipNum = this.ipToBigInt(ip);
    if (ipNum === null) return false;

    for (const net of this.allowedNetworks) {
      if (ipNum >= net.start && ipNum <= net.end) return true;
    }

    return false;
  }

  private parseCidr(
    cidr: string,
  ): { start: bigint; end: bigint } | null {
    const [ipPart, prefixPart] = cidr.split('/');
    const prefix = parseInt(prefixPart ?? '', 10);
    if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return null;

    const ipNum = this.ipToBigInt(ipPart ?? '');
    if (ipNum === null) return null;

    const mask = prefix === 0 ? 0n : (0xffffffffn << (32n - BigInt(prefix))) & 0xffffffffn;
    const start = ipNum & mask;
    const end = start | (~mask & 0xffffffffn);
    return { start, end };
  }

  private ipToBigInt(ip: string): bigint | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;

    let result = 0n;
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (!Number.isFinite(num) || num < 0 || num > 255) return null;
      result = (result << 8n) | BigInt(num);
    }
    return result;
  }
}

