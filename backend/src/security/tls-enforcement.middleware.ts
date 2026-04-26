import { Injectable, NestMiddleware, HttpStatus, Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const TLS_MINIMUM = /^TLSv1\.(2|3)$/i;

@Injectable()
export class TlsEnforcementMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TlsEnforcementMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const forwardedProto =
      (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0].trim().toLowerCase();
    const isSecure = req.secure || forwardedProto === 'https';

    if (!isSecure) {
      this.logger.warn(
        `Rejected non-secure request: ${req.method} ${req.originalUrl} from ${req.ip}`,
      );
      res.status(HttpStatus.UPGRADE_REQUIRED).json({
        statusCode: HttpStatus.UPGRADE_REQUIRED,
        message: 'HTTPS is required for all requests.',
      });
      return;
    }

    const socket = req.socket as unknown as { getProtocol?: () => string };
    const tlsProtocol = socket.getProtocol?.();
    if (tlsProtocol && !TLS_MINIMUM.test(tlsProtocol)) {
      this.logger.warn(
        `Rejected weak TLS protocol: ${tlsProtocol} for ${req.method} ${req.originalUrl}`,
      );
      res.status(HttpStatus.FORBIDDEN).json({
        statusCode: HttpStatus.FORBIDDEN,
        message: 'TLS 1.2 or higher is required.',
      });
      return;
    }

    next();
  }
}
