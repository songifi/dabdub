import { Test, TestingModule } from '@nestjs/testing';
import geoip from 'geoip-lite';
import { GeoService } from './geo.service';
import { AppConfigService } from '../app-config/app-config.service';
import { REDIS_CLIENT } from '../cache/redis.module';

jest.mock('geoip-lite');

describe('GeoService', () => {
  let service: GeoService;
  const appConfigGet = jest.fn();
  const redisMock = {
    hincrby: jest.fn(),
    expire: jest.fn(),
    hgetall: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoService,
        {
          provide: AppConfigService,
          useValue: {
            get: appConfigGet,
          },
        },
        {
          provide: REDIS_CLIENT,
          useValue: redisMock,
        },
      ],
    }).compile();

    service = module.get(GeoService);
  });

  it('returns NG for private/local IPs', () => {
    expect(service.getCountry('127.0.0.1')).toBe('NG');
    expect(service.getCountry('10.0.1.4')).toBe('NG');
    expect(service.getCountry('192.168.1.8')).toBe('NG');
  });

  it('isAllowed returns true for NG country', async () => {
    appConfigGet.mockResolvedValue(['NG']);
    (geoip.lookup as jest.Mock).mockReturnValue({ country: 'NG' });

    await expect(service.isAllowed('102.89.0.1')).resolves.toBe(true);
  });

  it('isAllowed returns false for non-NG country by default', async () => {
    appConfigGet.mockResolvedValue(['NG']);
    (geoip.lookup as jest.Mock).mockReturnValue({ country: 'US' });

    await expect(service.isAllowed('8.8.8.8')).resolves.toBe(false);
  });

  it('getLocationContext returns location and vpn/datacenter flags', async () => {
    appConfigGet.mockImplementation(async (key: string) => {
      if (key === 'vpn_cidrs') return ['8.8.8.0/24'];
      if (key === 'datacenter_cidrs') return ['1.1.1.0/24'];
      return ['NG'];
    });
    (geoip.lookup as jest.Mock).mockReturnValue({
      country: 'US',
      city: 'Mountain View',
      region: 'CA',
    });

    const context = await service.getLocationContext('8.8.8.8');
    expect(context).toEqual({
      country: 'US',
      city: 'Mountain View',
      region: 'CA',
      isVpn: true,
      isDatacenter: false,
    });
  });
});
