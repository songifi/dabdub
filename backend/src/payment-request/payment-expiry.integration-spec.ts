import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentRequestService } from './payment-request.service';
import { PaymentRequestRepository } from './repositories/payment-request.repository';
import { QrCodeService } from './services/qr-code.service';
import { StellarContractService } from './services/stellar-contract.service';
import { GlobalConfigService } from '../config/global-config.service';
import { JobsService } from '../modules/jobs/jobs.service';
import {
  PaymentRequest,
  PaymentRequestStatus,
  PaymentRequestType,
} from '../database/entities/payment-request.entity';
import { Merchant } from '../database/entities/merchant.entity';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MERCHANT_ID = 'merchant-uuid-001';
const STELLAR_CONFIG = {
  activeNetwork: 'testnet',
  networks: { testnet: { backendSecretKey: 'S_BACKEND' } },
  defaultExpirationMinutes: 30,
  minPaymentAmount: 0.1,
  maxPaymentAmount: 10_000,
};

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockRepo = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIdempotencyKey: jest.fn(),
  update: jest.fn(),
  search: jest.fn(),
  getStats: jest.fn(),
  getStatsInRange: jest.fn(),
  findExpired: jest.fn(),
  updateBatchStatus: jest.fn(),
};

const mockQr = {
  generateQrCode: jest.fn().mockResolvedValue('data:image/png;base64,mock'),
  buildSep0007Uri: jest
    .fn()
    .mockReturnValue('web+stellar:pay?destination=G&amount=100'),
};

const mockContract = {
  createOnChainRequest: jest.fn().mockResolvedValue(null),
  markPaidOnChain: jest.fn().mockResolvedValue(null),
  cancelOnChain: jest.fn().mockResolvedValue(null),
  getWalletAddress: jest.fn().mockReturnValue('G_VAULT_ADDRESS'),
};

const mockConfig = {
  getStellarConfig: jest.fn().mockReturnValue(STELLAR_CONFIG),
};

const mockMerchantRepo = {
  findOne: jest.fn().mockResolvedValue({ id: MERCHANT_ID, settings: null }),
};

const mockJobsService = {
  schedulePaymentExpiry: jest.fn().mockResolvedValue({ id: 'job-123' }),
  cancelPaymentExpiry: jest.fn().mockResolvedValue(undefined),
};

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('PaymentRequestService — Expiry Flow Integration', () => {
  let service: PaymentRequestService;
  let jobsService: JobsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRequestService,
        { provide: PaymentRequestRepository, useValue: mockRepo },
        { provide: QrCodeService, useValue: mockQr },
        { provide: StellarContractService, useValue: mockContract },
        { provide: GlobalConfigService, useValue: mockConfig },
        { provide: getRepositoryToken(Merchant), useValue: mockMerchantRepo },
        { provide: JobsService, useValue: mockJobsService },
      ],
    }).compile();

    service = module.get<PaymentRequestService>(PaymentRequestService);
    jobsService = module.get<JobsService>(JobsService);
  });

  describe('Payment expiry job scheduling', () => {
    it('should schedule expiry job when payment request is created', async () => {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      const mockPaymentRequest: PaymentRequest = {
        id: 'req-uuid-001',
        merchantId: MERCHANT_ID,
        amount: 100,
        currency: 'USDC',
        status: PaymentRequestStatus.PENDING,
        type: PaymentRequestType.PAYMENT,
        stellarNetwork: 'testnet',
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentRequest;

      mockRepo.create.mockResolvedValue(mockPaymentRequest);

      const result = await service.create({
        merchantId: MERCHANT_ID,
        amount: 100,
        currency: 'USDC',
      });

      expect(result).toBeDefined();
      expect(mockJobsService.schedulePaymentExpiry).toHaveBeenCalledWith(
        mockPaymentRequest.id,
        expect.any(Date),
        expect.objectContaining({
          merchantId: MERCHANT_ID,
        }),
      );
    });

    it('should NOT schedule expiry job when expiresAt is in the past', async () => {
      const expiresAt = new Date(Date.now() - 60 * 1000); // 1 minute ago
      const mockPaymentRequest: PaymentRequest = {
        id: 'req-uuid-002',
        merchantId: MERCHANT_ID,
        amount: 100,
        currency: 'USDC',
        status: PaymentRequestStatus.PENDING,
        type: PaymentRequestType.PAYMENT,
        stellarNetwork: 'testnet',
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentRequest;

      mockRepo.create.mockResolvedValue(mockPaymentRequest);

      await service.create({
        merchantId: MERCHANT_ID,
        amount: 100,
        currency: 'USDC',
      });

      expect(mockJobsService.schedulePaymentExpiry).not.toHaveBeenCalled();
    });
  });

  describe('Payment expiry job cancellation', () => {
    it('should cancel expiry job when payment is processed', async () => {
      const mockPaymentRequest: PaymentRequest = {
        id: 'req-uuid-003',
        merchantId: MERCHANT_ID,
        amount: 100,
        currency: 'USDC',
        status: PaymentRequestStatus.PENDING,
        type: PaymentRequestType.PAYMENT,
        stellarNetwork: 'testnet',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        statusHistory: [
          { status: PaymentRequestStatus.PENDING, timestamp: new Date().toISOString() },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentRequest;

      mockRepo.findById.mockResolvedValue(mockPaymentRequest);
      mockRepo.update.mockResolvedValue({
        ...mockPaymentRequest,
        status: PaymentRequestStatus.PROCESSING,
      });

      await service.process(mockPaymentRequest.id);

      expect(mockJobsService.cancelPaymentExpiry).toHaveBeenCalledWith(
        mockPaymentRequest.id,
      );
    });

    it('should cancel expiry job when payment is cancelled', async () => {
      const mockPaymentRequest: PaymentRequest = {
        id: 'req-uuid-004',
        merchantId: MERCHANT_ID,
        amount: 100,
        currency: 'USDC',
        status: PaymentRequestStatus.PENDING,
        type: PaymentRequestType.PAYMENT,
        stellarNetwork: 'testnet',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        statusHistory: [
          { status: PaymentRequestStatus.PENDING, timestamp: new Date().toISOString() },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentRequest;

      mockRepo.findById.mockResolvedValue(mockPaymentRequest);
      mockRepo.update.mockResolvedValue({
        ...mockPaymentRequest,
        status: PaymentRequestStatus.CANCELLED,
      });

      await service.cancel(mockPaymentRequest.id, 'Customer requested');

      expect(mockJobsService.cancelPaymentExpiry).toHaveBeenCalledWith(
        mockPaymentRequest.id,
      );
    });

    it('should NOT cancel expiry job when payment is already completed', async () => {
      const mockPaymentRequest: PaymentRequest = {
        id: 'req-uuid-005',
        merchantId: MERCHANT_ID,
        amount: 100,
        currency: 'USDC',
        status: PaymentRequestStatus.COMPLETED,
        type: PaymentRequestType.PAYMENT,
        stellarNetwork: 'testnet',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        statusHistory: [
          { status: PaymentRequestStatus.PENDING, timestamp: new Date().toISOString() },
          { status: PaymentRequestStatus.COMPLETED, timestamp: new Date().toISOString() },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as PaymentRequest;

      mockRepo.findById.mockResolvedValue(mockPaymentRequest);

      await expect(
        service.cancel(mockPaymentRequest.id, 'Customer requested'),
      ).rejects.toThrow();

      expect(mockJobsService.cancelPaymentExpiry).not.toHaveBeenCalled();
    });
  });
});
