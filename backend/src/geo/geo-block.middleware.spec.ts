import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import type { NextFunction, Request, Response } from 'express';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GeoBlockMiddleware } from './geo-block.middleware';
import { GeoService } from './geo.service';
import { AppConfigService } from '../app-config/app-config.service';
import { WaitlistFraudLog } from '../waitlist/entities/waitlist-fraud-log.entity';
import { SecurityAlert, SecurityAlertType } from '../security/entities';

describe('GeoBlockMiddleware', () => {
  let middleware: GeoBlockMiddleware;
  let geoService: jest.Mocked<GeoService>;
  let appConfigService: { get: jest.Mock };
  let waitlistFraudLogRepo: jest.Mocked<Repository<WaitlistFraudLog>>;
  let securityAlertRepo: jest.Mocked<Repository<SecurityAlert>>;
  let req: Partial<Request & { user?: { id: string } }>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoBlockMiddleware,
        {
          provide: GeoService,
          useValue: {
            getCountry: jest.fn(),
            isAllowed: jest.fn(),
            getLocationContext: jest.fn(),
            recordBlockedCountry: jest.fn(),
            normalizeIp: jest.fn((value: string) => value),
          },
        },
        {
          provide: AppConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WaitlistFraudLog),
          useValue: {
            create: jest.fn((value: unknown) => value),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(SecurityAlert),
          useValue: {
            create: jest.fn((value: unknown) => value),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    middleware = module.get(GeoBlockMiddleware);
    geoService = module.get(GeoService);
    appConfigService = module.get(AppConfigService);
    waitlistFraudLogRepo = module.get(getRepositoryToken(WaitlistFraudLog));
    securityAlertRepo = module.get(getRepositoryToken(SecurityAlert));

    req = {
      path: '/api/v1/transfers',
      originalUrl: '/api/v1/transfers',
      headers: {},
      socket: { remoteAddress: '102.89.0.1' } as any,
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();

    appConfigService.get.mockResolvedValue(true);
    geoService.getCountry.mockReturnValue('NG');
    geoService.isAllowed.mockResolvedValue(true);
    geoService.getLocationContext.mockResolvedValue({
      country: 'NG',
      city: 'Lagos',
      region: 'LA',
      isVpn: false,
      isDatacenter: false,
    });
  });

  it('allows NG IPs', async () => {
    await middleware.use(req as any, res as any, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks non-NG IPs with 451', async () => {
    geoService.getCountry.mockReturnValue('US');
    geoService.isAllowed.mockResolvedValue(false);

    await middleware.use(req as any, res as any, next);

    expect(geoService.recordBlockedCountry).toHaveBeenCalledWith('US');
    expect(res.status).toHaveBeenCalledWith(451);
    expect(res.json).toHaveBeenCalledWith({
      code: 'GEO_BLOCKED',
      message: 'Cheese Pay is currently only available in Nigeria.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows private IPs via dev bypass', async () => {
    req.socket = { remoteAddress: '127.0.0.1' } as any;
    geoService.getCountry.mockReturnValue('NG');
    geoService.isAllowed.mockResolvedValue(true);

    await middleware.use(req as any, res as any, next);
    expect(next).toHaveBeenCalled();
  });

  it('creates suspicious_ip alert for VPN but does not block', async () => {
    req.user = { id: 'user-1' };
    geoService.getLocationContext.mockResolvedValue({
      country: 'NG',
      city: 'Lagos',
      region: 'LA',
      isVpn: true,
      isDatacenter: false,
    });
    geoService.isAllowed.mockResolvedValue(true);

    await middleware.use(req as any, res as any, next);

    expect(securityAlertRepo.create).toHaveBeenCalledWith({
      userId: 'user-1',
      type: SecurityAlertType.SUSPICIOUS_IP,
      message: 'Suspicious IP signal detected from 102.89.0.1 (NG)',
    });
    expect(securityAlertRepo.save).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('bypasses geo-blocking when geo_blocking_enabled=false', async () => {
    appConfigService.get.mockResolvedValue(false);

    await middleware.use(req as any, res as any, next);
    expect(next).toHaveBeenCalled();
    expect(geoService.isAllowed).not.toHaveBeenCalled();
  });

  it('soft-blocks waitlist join from non-NG by logging fraud entry', async () => {
    req.path = '/api/v1/waitlist/join';
    req.originalUrl = '/api/v1/waitlist/join';
    req.body = { email: 'nonng@example.com' };
    geoService.getCountry.mockReturnValue('US');

    await middleware.use(req as any, res as any, next);

    expect(waitlistFraudLogRepo.create).toHaveBeenCalledWith({
      email: 'nonng@example.com',
      ip: '102.89.0.1',
      rule: 'GEO_NON_NG_WAITLIST',
      action: 'flagged',
      details: {
        country: 'US',
        reason: 'Non-NG waitlist signup (soft-block)',
      },
    });
    expect(next).toHaveBeenCalled();
  });
});
