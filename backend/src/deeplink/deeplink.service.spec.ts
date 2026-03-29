import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DeepLinkService } from './deeplink.service';
import { DeepLinkType } from '../common/constants/deep-links';
import { deeplinkConfig } from '../config/deeplink.config';

const cfg = {
  appleTeamId: 'ABCD1234',
  appleBundleId: 'xyz.cheesepay.app',
  androidPackage: 'xyz.cheesepay.app',
  androidSha256: 'AA:BB:CC:DD',
};

describe('DeepLinkService', () => {
  let service: DeepLinkService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeepLinkService,
        { provide: deeplinkConfig.KEY, useValue: cfg },
      ],
    }).compile();

    service = module.get<DeepLinkService>(DeepLinkService);
  });

  it('generate PAY produces correctly encoded URL', () => {
    const url = service.generate(DeepLinkType.PAY, { to: 'johndoe', amount: '1000' });
    expect(url).toBe('cheesewallet://pay?to=johndoe&amount=1000');
  });

  it('generate PAY without to throws BadRequestException', () => {
    expect(() =>
      service.generate(DeepLinkType.PAY, { to: '' }),
    ).toThrow(BadRequestException);
  });

  it('generate PAYLINK produces correct URL', () => {
    const url = service.generate(DeepLinkType.PAYLINK, { id: 'abc-123' });
    expect(url).toBe('cheesewallet://paylink?id=abc-123');
  });

  it('generate KYC produces correct URL with no params', () => {
    const url = service.generate(DeepLinkType.KYC, {});
    expect(url).toBe('cheesewallet://kyc');
  });

  it('generateWebFallback returns valid HTTPS URL', () => {
    const deepLink = 'cheesewallet://pay?to=johndoe';
    const fallback = service.generateWebFallback(deepLink);
    expect(fallback).toMatch(/^https:\/\/pay\.cheesepay\.xyz\/redirect\?to=/);
    expect(fallback).toContain(encodeURIComponent(deepLink));
  });

  it('getAppleAppSiteAssociation returns correct JSON structure', () => {
    const aasa = service.getAppleAppSiteAssociation() as { applinks: { details: { appID: string }[] } };
    expect(aasa.applinks.details[0].appID).toBe('ABCD1234.xyz.cheesepay.app');
  });
});
