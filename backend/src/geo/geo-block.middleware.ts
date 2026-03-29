import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigService } from '../app-config/app-config.service';
import { WaitlistFraudLog, FraudAction } from '../waitlist/entities/waitlist-fraud-log.entity';
import { GeoService } from './geo.service';
import { SecurityAlert, SecurityAlertType } from '../security/entities';

interface RequestWithOptionalUser extends Request {
  user?: { id?: string };
}

@Injectable()
export class GeoBlockMiddleware implements NestMiddleware {
  constructor(
    private readonly geoService: GeoService,
    private readonly appConfigService: AppConfigService,
    @InjectRepository(WaitlistFraudLog)
    private readonly waitlistFraudLogRepo: Repository<WaitlistFraudLog>,
    @InjectRepository(SecurityAlert)
    private readonly securityAlertRepo: Repository<SecurityAlert>,
  ) {}

  async use(
    req: RequestWithOptionalUser,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const requestPath = req.originalUrl || req.path;

    if (!requestPath.startsWith('/api/')) {
      next();
      return;
    }

    const geoBlockingEnabled = await this.appConfigService.get<boolean>(
      'geo_blocking_enabled',
      true,
    );
    if (geoBlockingEnabled === false) {
      next();
      return;
    }

    const ip = this.extractIp(req);
    const country = this.geoService.getCountry(ip);
    const waitlistJoinPath = '/api/v1/waitlist/join';
    const healthPaths = new Set(['/health', '/api/v1/health', '/api/health']);
    const isWaitlistJoin = requestPath.startsWith(waitlistJoinPath);
    const isHealth = healthPaths.has(requestPath);

    if (isHealth) {
      next();
      return;
    }

    if (isWaitlistJoin) {
      if (country !== 'NG') {
        const bodyEmail =
          typeof req.body?.email === 'string' && req.body.email.includes('@')
            ? req.body.email
            : 'unknown@geo.invalid';
        await this.waitlistFraudLogRepo.save(
          this.waitlistFraudLogRepo.create({
            email: bodyEmail,
            ip,
            rule: 'GEO_NON_NG_WAITLIST',
            action: FraudAction.FLAGGED,
            details: {
              country,
              reason: 'Non-NG waitlist signup (soft-block)',
            },
          }),
        );
      }
      next();
      return;
    }

    const location = await this.geoService.getLocationContext(ip);
    if ((location.isVpn || location.isDatacenter) && req.user?.id) {
      await this.securityAlertRepo.save(
        this.securityAlertRepo.create({
          userId: req.user.id,
          type: SecurityAlertType.SUSPICIOUS_IP,
          message: `Suspicious IP signal detected from ${ip} (${country})`,
        }),
      );
    }

    if (!(await this.geoService.isAllowed(ip))) {
      await this.geoService.recordBlockedCountry(country);
      res.status(451).json({
        code: 'GEO_BLOCKED',
        message: 'Cheese Pay is currently only available in Nigeria.',
      });
      return;
    }

    next();
  }

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return this.geoService.normalizeIp(String(forwarded));
    }
    return this.geoService.normalizeIp(req.socket?.remoteAddress ?? req.ip ?? '');
  }
}
