import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payment, PaymentStatus } from '../database/entities/payment.entity';
import { PlatformWallet } from '../treasury/entities/platform-wallet.entity';
import { PaymentService } from './payment.service';
import { PaymentMetrics } from './payment.metrics';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

const mockPaymentRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockPlatformWalletRepository = {
  findOne: jest.fn(),
};

const mockExchangeRateService = {
  getFiatToUsdRate: jest.fn(),
};

const mockPaymentMetrics = {
  incrementPaymentProcessed: jest.fn(),
  incrementPaymentFailed: jest.fn(),
};

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepository },
        {
          provide: getRepositoryToken(PlatformWallet),
          useValue: mockPlatformWalletRepository,
        },
        { provide: PaymentMetrics, useValue: mockPaymentMetrics },
        { provide: ExchangeRateService, useValue: mockExchangeRateService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentRequest', () => {
    const validDto: CreatePaymentRequestDto = {
      amount: 100,
      currency: 'USD',
      chain: 'polygon',
    };

    it('throws BadRequestException for unsupported chain', async () => {
      await expect(
        service.createPaymentRequest(
          { ...validDto, chain: 'unsupported' as any },
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPaymentRepository.save).not.toHaveBeenCalled();
    });

    it('returns existing payment when idempotency key matches', async () => {
      const existing = {
        id: 'existing-id',
        depositAddress: '0x123',
        usdcAmount: 100,
        network: 'polygon',
        expiresAt: new Date(Date.now() + 60000),
      } as Payment;
      mockPaymentRepository.findOne.mockResolvedValue(existing);

      const result = await service.createPaymentRequest(validDto, 'key-1');

      expect(result.paymentId).toBe('existing-id');
      expect(result.depositAddress).toBe('0x123');
      expect(result.usdcAmount).toBe(100);
      expect(mockPaymentRepository.save).not.toHaveBeenCalled();
    });

    it('creates payment with USDC amount from fiat and rate, default expiry 30 min', async () => {
      mockPaymentRepository.findOne.mockResolvedValue(null);
      mockExchangeRateService.getFiatToUsdRate.mockResolvedValue(1);
      mockPlatformWalletRepository.findOne.mockResolvedValue({
        walletAddress: '0xDeposit',
      });
      const saved = {
        id: 'new-id',
        depositAddress: '0xDeposit',
        usdcAmount: 100,
        network: 'polygon',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      } as Payment;
      mockPaymentRepository.create.mockReturnValue(saved);
      mockPaymentRepository.save.mockResolvedValue(saved);

      const result = await service.createPaymentRequest(validDto);

      expect(mockExchangeRateService.getFiatToUsdRate).toHaveBeenCalledWith(
        'USD',
      );
      expect(result.paymentId).toBe('new-id');
      expect(result.depositAddress).toBe('0xDeposit');
      expect(result.usdcAmount).toBe(100);
      expect(result.expiresAt).toBeDefined();
      expect(result.qrPayload).toContain('USDC');
    });

    it('uses custom expiresInMinutes and converts fiat with rate', async () => {
      mockPaymentRepository.findOne.mockResolvedValue(null);
      mockExchangeRateService.getFiatToUsdRate.mockResolvedValue(0.85); // EUR -> USD
      mockPlatformWalletRepository.findOne.mockResolvedValue({
        walletAddress: '0xBase',
      });
      const saved = {
        id: 'id-2',
        depositAddress: '0xBase',
        usdcAmount: 85, // 100 EUR * 0.85
        network: 'base',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      } as Payment;
      mockPaymentRepository.create.mockReturnValue(saved);
      mockPaymentRepository.save.mockResolvedValue(saved);

      const result = await service.createPaymentRequest({
        amount: 100,
        currency: 'EUR',
        chain: 'base',
        expiresInMinutes: 60,
      });

      expect(mockExchangeRateService.getFiatToUsdRate).toHaveBeenCalledWith(
        'EUR',
      );
      expect(result.usdcAmount).toBe(85);
    });

    it('throws BadRequestException when expiresInMinutes out of range', async () => {
      await expect(
        service.createPaymentRequest(
          { ...validDto, expiresInMinutes: 0 },
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createPaymentRequest(
          { ...validDto, expiresInMinutes: 24 * 60 + 1 },
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createPayment (legacy)', () => {
    it('creates payment and returns details', async () => {
      const dto: CreatePaymentDto = {
        amount: 1000,
        currency: 'USD',
        idempotencyKey: 'legacy-key',
      };
      mockPaymentRepository.findOne.mockResolvedValue(null);
      const saved = {
        id: 'legacy-id',
        amount: 1000,
        currency: 'USD',
        status: PaymentStatus.PENDING,
        reference: 'legacy-key',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Payment;
      mockPaymentRepository.create.mockReturnValue(saved);
      mockPaymentRepository.save.mockResolvedValue(saved);

      const result = await service.createPayment(dto);

      expect(result.id).toBe('legacy-id');
      expect(result.amount).toBe(1000);
      expect(result.currency).toBe('USD');
    });
  });
});
