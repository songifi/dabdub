import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { FlutterwaveService } from './flutterwave.service';
import { flutterwaveConfig } from '../config/flutterwave.config';

const cfg = {
  secretKey: 'test-secret',
  webhookSecret: 'webhook-secret-value',
  baseUrl: 'https://api.flutterwave.com',
};

const mockPost = jest.fn();
const mockGet = jest.fn();
const mockRedisGet = jest.fn().mockResolvedValue(null);
const mockRedisSet = jest.fn().mockResolvedValue('OK');

describe('FlutterwaveService', () => {
  let service: FlutterwaveService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlutterwaveService,
        {
          provide: HttpService,
          useValue: { post: mockPost, get: mockGet },
        },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: { get: mockRedisGet, set: mockRedisSet },
        },
        { provide: flutterwaveConfig.KEY, useValue: cfg },
      ],
    }).compile();

    service = module.get<FlutterwaveService>(FlutterwaveService);
    jest.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
  });

  it('createVirtualAccount returns account details', async () => {
    mockPost.mockReturnValue(
      of({
        data: {
          status: 'success',
          data: { account_number: '0123456789', bank_name: 'Wema Bank', flw_ref: 'REF123' },
        },
      }),
    );

    const result = await service.createVirtualAccount({
      email: 'user@example.com',
      bvn: '12345678901',
      firstname: 'John',
      lastname: 'Doe',
      narration: 'johndoe',
    });

    expect(result.accountNumber).toBe('0123456789');
    expect(result.bankName).toBe('Wema Bank');
    expect(result.reference).toBe('REF123');
  });

  it('duplicate reference throws 409', async () => {
    const error = Object.assign(new Error('dup'), {
      response: { status: 400, data: { code: 'DUPLICATE_REFERENCE', message: 'Duplicate reference' } },
    });
    mockPost.mockReturnValue(throwError(() => error));

    await expect(
      service.initiateTransfer({
        accountBank: '044',
        accountNumber: '0123456789',
        amount: 5000,
        narration: 'test',
        reference: 'dup-ref',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('verifyWebhookSignature returns true for matching secret', () => {
    const rawBody = Buffer.from('{}');
    expect(service.verifyWebhookSignature(rawBody, cfg.webhookSecret)).toBe(true);
  });

  it('verifyWebhookSignature returns false for wrong secret', () => {
    const rawBody = Buffer.from('{}');
    expect(service.verifyWebhookSignature(rawBody, 'wrong-secret-val')).toBe(false);
  });

  it('getBanks returns cached list without calling API', async () => {
    const banks = [{ id: 1, code: '044', name: 'Access Bank' }];
    mockRedisGet.mockResolvedValue(JSON.stringify(banks));

    const result = await service.getBanks();
    expect(result).toEqual(banks);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('invalid account throws 400', async () => {
    const error = Object.assign(new Error('invalid'), {
      response: { status: 400, data: { code: 'INVALID_ACCOUNT', message: 'Invalid account' } },
    });
    mockPost.mockReturnValue(throwError(() => error));

    await expect(
      service.initiateTransfer({
        accountBank: '044',
        accountNumber: '0000000000',
        amount: 100,
        narration: 'test',
        reference: 'ref-001',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
