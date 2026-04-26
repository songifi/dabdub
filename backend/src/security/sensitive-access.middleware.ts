import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SENSITIVE_PATHS = [
  /^\/admin(?:\/|$)/,
  /^\/security(?:\/|$)/,
  /^\/compliance(?:\/|$)/,
  /^\/withdrawals(?:\/|$)/,
  /^\/offramp(?:\/|$)/,
  /^\/onramp(?:\/|$)/,
  /^\/virtual-cards(?:\/|$)/,
  /^\/transactions(?:\/|$)/,
  /^\/bulk-payments(?:\/|$)/,
  /^\/bank-accounts(?:\/|$)/,
  /^\/receive(?:\/|$)/,
  /^\/settlement(?:\/|$)/,
  /^\/disputes(?:\/|$)/,
  /^\/paylink(?:\/|$)/,
  /^\/users(?:\/|$)/,
  /^\/wallets(?:\/|$)/,
  /^\/kyc(?:\/|$)/,
  /^\/webhooks(?:\/|$)/,
];

@Injectable()
export class SensitiveAccessLogMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SensitiveAccessLogMiddleware.name);

  use(req: Request, _res: Response, next: NextFunction): void {
    const path = req.baseUrl + req.path;
    const matchesSensitivePath = SENSITIVE_PATHS.some((pattern) => pattern.test(path));

    if (!matchesSensitivePath) {
      next();
      return;
    }

    const start = Date.now();
    _res.on('finish', () => {
      const durationMs = Date.now() - start;
      const user = (req as any).user;
      const actor = user
        ? `${user.id ?? 'unknown'} (${user.role ?? 'unknown'})`
        : 'anonymous';
      this.logger.log(
        `Sensitive access: ${req.method} ${path} by ${actor} from ${req.ip} - status=${_res.statusCode} duration=${durationMs}ms`,
      );
    });

    next();
  }
}
