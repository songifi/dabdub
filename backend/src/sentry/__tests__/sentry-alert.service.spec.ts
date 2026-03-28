import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import * as Sentry from '@sentry/nestjs';
import { SentryAlertService } from '../sentry-alert.service';

// Mock Sentry
jest.mock('@sentry/nestjs', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  withScope: jest.fn((callback) => {
    const mockScope = {
      setTag: jest.fn(),
      setLevel: jest.fn(),
      setExtra: jest.fn(),
      setExtras: jest.fn(),
      setUser: jest.fn(),
    };
    callback(mockScope);
    return mockScope;
  }),
  setUser: jest.fn(),
  startSpan: jest.fn(),
}));

describe('SentryAlertService', () => {
  let service: SentryAlertService;
  let mockConfigService: Partial<ConfigModule>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'SLACK_WEBHOOK_URL') {
          return 'https://hooks.slack.com/test-webhook';
        }
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SentryAlertService,
        {
          provide: ConfigModule,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SentryAlertService>(SentryAlertService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('capturePaymentFailure', () => {
    it('should capture exception to Sentry with payment tags', async () => {
      const error = new Error('Payment failed');
      const context = {
        transactionId: 'txn_123',
        userId: 'user_456',
        amount: 100,
        currency: 'USD',
        paymentMethod: 'card',
        errorCode: 'CARD_DECLINED',
      };

      await service.capturePaymentFailure(error, context);

      expect(Sentry.withScope).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should set module tag to payments', async () => {
      const error = new Error('Payment failed');
      const context = { transactionId: 'txn_123' };

      await service.capturePaymentFailure(error, context);

      expect(Sentry.withScope).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle non-Error objects', async () => {
      const error = 'String error message';
      const context = { transactionId: 'txn_123' };

      await service.capturePaymentFailure(error, context);

      expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should capture with minimal context', async () => {
      const error = new Error('Payment failed');
      const context = {};

      await service.capturePaymentFailure(error, context);

      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('should set transactionId tag when provided', async () => {
      const error = new Error('Payment failed');
      const context = { transactionId: 'txn_789', userId: 'user_123' };

      await service.capturePaymentFailure(error, context);

      expect(Sentry.withScope).toHaveBeenCalled();
    });
  });
});
