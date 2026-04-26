import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SentryService } from './sentry.service';

describe('SentryService', () => {
  let service: SentryService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SentryService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<SentryService>(SentryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('init', () => {
    it('should not initialize when SENTRY_DSN is not set', () => {
      configService.get.mockReturnValue({
        dsn: '',
        tracesSampleRate: 0.1,
        profilesSampleRate: 0.05,
        environment: 'test',
        enabled: false,
      });

      service.init();
      expect(service.isInitialized()).toBe(false);
    });

    it('should not initialize in test environment', () => {
      configService.get.mockReturnValue({
        dsn: 'https://test@example.com/1',
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0,
        environment: 'test',
        enabled: false,
      });

      service.init();
      expect(service.isInitialized()).toBe(false);
    });

    it('should initialize when DSN is set and not in test', () => {
      configService.get.mockReturnValue({
        dsn: 'https://test@example.com/1',
        tracesSampleRate: 0.1,
        profilesSampleRate: 0.05,
        environment: 'production',
        enabled: true,
      });

      service.init();
      expect(service.isInitialized()).toBe(true);
    });
  });
});

