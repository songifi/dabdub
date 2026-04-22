import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import * as crypto from 'crypto';
import { VirtualAccountService } from './virtual-account.service';
import { VirtualAccount, VirtualAccountProvider } from './entities/virtual-account.entity';
import { flutterwaveConfig } from '../config/flutterwave.config';
import { redisConfig } from '../config/redis.config';
import { CheeseGateway, WS_EVENTS } from '../ws/cheese.gateway';

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
  })),
);

const WEBHOOK_SECRET = 'test-webhook-secret';

const mockVaRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockHttpService = { post: jest.fn() };

const mockGateway = { emitToUser: jest.fn().mockResolvedValue(undefined) };

const mockRatesService = { convertNgnToUsdc: jest.fn() };

const mockSorobanService = { deposit: jest.fn().mockResolvedValue(undefined) };

const mockDepositsService = { createDeposit: jest.fn().mockResolvedValue(undefined) };

const mockFwConfig = {
  secretKey: 'FW-test-key',
  webhookSecret: WEBHOOK_SECRET,
  baseUrl: 'https://api.flutterwave.com',
};

const mockRedisConfig = { host: 'localhost', port: 6379, password: undefined };

function makeSignature(body: Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('VirtualAccountService', () => {
  let service: VirtualAccountService;
  let redisMock: { set: jest.Mock; get: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VirtualAccountService,
        { provide: getRepositoryToken(VirtualAccount), useValue: mockVaRepo },
        { provide: HttpService, useValue: mockHttpService },
        { provide: flutterwaveConfig.KEY, useValue: mockFwConfig },
        { provide: redisConfig.KEY, useValue: mockRedisConfig },
        { provide: CheeseGateway, useValue: mockGateway },
        { provide: RatesService, useValue: mockRatesService },
        { provide: SorobanService, useValue: mockSorobanService },
        { provide: DepositsService, useValue: mockDepositsService },
      ],
    }).compile();

    service = module.get(VirtualAccountService);
    redisMock = (service as any).redis;
  });

  describe('provision', () => {
    it('calls Flutterwave API and persists VirtualAccount', async () => {
      mockHttpService.post.mockReturnValue(
        of({
          data: {
            data: { account_number: '0123456789', bank_name: 'Wema Bank' },
          },
        }),
      );
      const saved = { id: 'va-1', userId: 'user-1', accountNumber: '0123456789' };
      mockVaRepo.create.mockReturnValue(saved);
      mockVaRepo.save.mockResolvedValue(saved);

      const result = await service.provision('user-1');

      expect(mockHttpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/v3/virtual-account-numbers'),
        expect.objectContaining({ is_permanent: true }),
        expect.any(Object),
      );
      expect(mockVaRepo.save).toHaveBeenCalled();
      expect(result).toEqual(saved);
    });
  });

  describe('handleWebhook', () => {
    function makeBody(reference: string, amount = 5000): Buffer {
      return Buffer.from(
        JSON.stringify({
          event: 'charge.completed',
          data: { tx_ref: reference, amount, currency: 'NGN' },
        }),
      );
    }

    it('credits wallet and emits balance_updated on valid webhook', async () => {
      const body = makeBody('va_user-1_111');
      const sig = makeSignature(body, WEBHOOK_SECRET);
      redisMock.set.mockResolvedValue('OK'); // first time — not duplicate
      mockVaRepo.findOne.mockResolvedValue({
        id: 'va-1',
        userId: 'user-1',
        reference: 'va_user-1_111',
        provider: VirtualAccountProvider.FLUTTERWAVE,
      });
      mockRatesService.convertNgnToUsdc.mockResolvedValue(3.25);

      await service.handleWebhook(body, sig);

      expect(mockRatesService.convertNgnToUsdc).toHaveBeenCalledWith(5000);
      expect(mockDepositsService.createDeposit).toHaveBeenCalledWith(
        'user-1',
        expect.any(Object),
        5000,
        3.25,
        'va_user-1_111',
        undefined,
      );
      expect(mockSorobanService.deposit).toHaveBeenCalledWith('user-1', 3.25);
      expect(mockGateway.emitToUser).toHaveBeenCalledWith(
        'user-1',
        WS_EVENTS.BALANCE_UPDATED,
        expect.objectContaining({ ngnAmount: 5000, usdcAmount: 3.25 }),
      );
    });

    it('skips processing on duplicate reference', async () => {
      const body = makeBody('va_user-1_dup');
      const sig = makeSignature(body, WEBHOOK_SECRET);
      redisMock.set.mockResolvedValue(null); // already exists — duplicate

      await service.handleWebhook(body, sig);

      expect(mockVaRepo.findOne).not.toHaveBeenCalled();
      expect(mockRatesService.convertNgnToUsdc).not.toHaveBeenCalled();
      expect(mockDepositsService.createDeposit).not.toHaveBeenCalled();
      expect(mockSorobanService.deposit).not.toHaveBeenCalled();
      expect(mockGateway.emitToUser).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException on invalid HMAC signature', async () => {
      const body = makeBody('va_user-1_bad');

      await expect(service.handleWebhook(body, 'deadbeef')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
