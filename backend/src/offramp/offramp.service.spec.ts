import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { OffRampService, SPREAD_PERCENT, RATE_LOCK_THRESHOLD } from './offramp.service';
import { OffRamp, OffRampStatus } from './entities/off-ramp.entity';
import { BankAccount } from '../bank-accounts/entities/bank-account.entity';
import { User } from '../users/entities/user.entity';
import { TierConfig, TierName } from '../tier-config/entities/tier-config.entity';
import { FeeConfig, FeeType } from '../fee-config/entities/fee-config.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { RatesService } from '../rates/rates.service';
import { SorobanService } from '../soroban/soroban.service';
import { PinService } from '../pin/pin.service';

const mockUser = (): User =>
  ({
    id: 'user-uuid',
    username: 'alice',
    tier: TierName.SILVER,
    pinHash: 'hashed-pin',
  }) as User;

const mockBankAccount = (): BankAccount =>
  ({
    id: 'bank-uuid',
    userId: 'user-uuid',
    bankCode: '058',
    bankName: 'GTBank',
    accountNumber: '0123456789',
    accountName: 'Alice Doe',
    isDefault: true,
    isVerified: true,
  }) as BankAccount;

const mockFeeConfig = (): FeeConfig =>
  ({
    feeType: FeeType.WITHDRAWAL,
    baseFeeRate: '0.010000',
    minFee: '0.50000000',
    maxFee: '5.00000000',
    isActive: true,
  }) as FeeConfig;

const mockTierConfig = (): TierConfig =>
  ({
    tier: TierName.SILVER,
    maxSingleWithdrawalUsdc: '500.00000000',
    isActive: true,
  }) as TierConfig;

const mockOffRamp = (): OffRamp =>
  ({
    id: 'offramp-uuid',
    userId: 'user-uuid',
    amountUsdc: '10.00000000',
    feeUsdc: '0.50000000',
    netAmountUsdc: '9.50000000',
    rate: '1600',
    spreadPercent: '1.50',
    ngnAmount: '14960.00',
    bankAccountId: 'bank-uuid',
    bankAccountNumber: '0123456789',
    bankName: 'GTBank',
    accountName: 'Alice Doe',
    reference: 'OFFRAMP-ABC123',
    providerReference: null,
    status: OffRampStatus.PENDING,
    failureReason: null,
    transactionId: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as OffRamp;

describe('OffRampService', () => {
  let service: OffRampService;
  let offRampRepo: any;
  let bankAccountRepo: any;
  let userRepo: any;
  let tierConfigRepo: any;
  let feeConfigRepo: any;
  let transactionRepo: any;
  let ratesService: jest.Mocked<RatesService>;
  let sorobanService: jest.Mocked<SorobanService>;
  let pinService: jest.Mocked<PinService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffRampService,
        { provide: getRepositoryToken(OffRamp), useValue: { create: jest.fn(), save: jest.fn(), update: jest.fn(), findOne: jest.fn(), findAndCount: jest.fn() } },
        { provide: getRepositoryToken(BankAccount), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(TierConfig), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(FeeConfig), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(Transaction), useValue: { create: jest.fn(), save: jest.fn(), update: jest.fn() } },
        { provide: RatesService, useValue: { getRate: jest.fn() } },
        { provide: SorobanService, useValue: { withdraw: jest.fn(), deposit: jest.fn() } },
        { provide: PinService, useValue: { verifyPin: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-paystack-key') } },
      ],
    }).compile();

    service = module.get(OffRampService);
    offRampRepo = module.get(getRepositoryToken(OffRamp));
    bankAccountRepo = module.get(getRepositoryToken(BankAccount));
    userRepo = module.get(getRepositoryToken(User));
    tierConfigRepo = module.get(getRepositoryToken(TierConfig));
    feeConfigRepo = module.get(getRepositoryToken(FeeConfig));
    transactionRepo = module.get(getRepositoryToken(Transaction));
    ratesService = module.get(RatesService);
    sorobanService = module.get(SorobanService);
    pinService = module.get(PinService);
  });

  // ── preview ─────────────────────────────────────────────────────────────────

  describe('preview', () => {
    it('returns correct preview with NGN amount', async () => {
      ratesService.getRate.mockResolvedValue({ rate: '1600', fetchedAt: new Date(), source: 'bybit', isStale: false });
      feeConfigRepo.findOne.mockResolvedValue(mockFeeConfig());
      bankAccountRepo.findOne.mockResolvedValue(mockBankAccount());

      const result = await service.preview('user-uuid', { amountUsdc: 10 });

      expect(result.amountUsdc).toBe(10);
      expect(result.rate).toBe('1600');
      expect(result.spreadPercent).toBe(1.5);
      expect(parseFloat(result.feeUsdc)).toBeCloseTo(0.5, 2);
      expect(parseFloat(result.netAmountUsdc)).toBeCloseTo(9.5, 2);
      // ngnAmount = 9.5 * 1600 * (1 - 0.015) = 14960
      expect(parseFloat(result.ngnAmount)).toBeCloseTo(14960, 0);
      expect(result.bankAccount?.bankName).toBe('GTBank');
    });

    it('throws BadRequestException for amount below minimum', async () => {
      await expect(service.preview('user-uuid', { amountUsdc: 0.5 })).rejects.toThrow(BadRequestException);
    });

    it('returns null bankAccount when no default bank set', async () => {
      ratesService.getRate.mockResolvedValue({ rate: '1600', fetchedAt: new Date(), source: 'bybit', isStale: false });
      feeConfigRepo.findOne.mockResolvedValue(mockFeeConfig());
      bankAccountRepo.findOne.mockResolvedValue(null);

      const result = await service.preview('user-uuid', { amountUsdc: 10 });
      expect(result.bankAccount).toBeNull();
    });
  });

  // ── rate lock ────────────────────────────────────────────────────────────────

  describe('checkRateLock', () => {
    it('throws when rate changed more than 2%', () => {
      const previewRate = 1600;
      const currentRate = 1640; // 2.5% change
      expect(() => service.checkRateLock(previewRate, currentRate)).toThrow(
        'Rate has changed significantly. Please preview again.',
      );
    });

    it('does not throw when rate changed less than 2%', () => {
      const previewRate = 1600;
      const currentRate = 1615; // ~0.9% change
      expect(() => service.checkRateLock(previewRate, currentRate)).not.toThrow();
    });

    it('does not throw at exactly 2% change', () => {
      const previewRate = 1600;
      const currentRate = 1632; // exactly 2%
      expect(() => service.checkRateLock(previewRate, currentRate)).not.toThrow();
    });
  });

  // ── execute ──────────────────────────────────────────────────────────────────

  describe('execute', () => {
    const setupMocks = () => {
      pinService.verifyPin.mockResolvedValue(undefined);
      userRepo.findOne.mockResolvedValue(mockUser());
      bankAccountRepo.findOne.mockResolvedValue(mockBankAccount());
      tierConfigRepo.findOne.mockResolvedValue(mockTierConfig());
      ratesService.getRate.mockResolvedValue({ rate: '1600', fetchedAt: new Date(), source: 'bybit', isStale: false });
      feeConfigRepo.findOne.mockResolvedValue(mockFeeConfig());
      const offRamp = mockOffRamp();
      offRampRepo.create.mockReturnValue(offRamp);
      offRampRepo.save.mockResolvedValue(offRamp);
      offRampRepo.update.mockResolvedValue(undefined);
      offRampRepo.findOne.mockResolvedValue({ ...offRamp, status: OffRampStatus.TRANSFER_INITIATED, providerReference: 'TRF_123' });
      sorobanService.withdraw.mockResolvedValue(undefined);
      const tx = { id: 'tx-uuid' };
      transactionRepo.create.mockReturnValue(tx);
      transactionRepo.save.mockResolvedValue(tx);
    };

    it('requires PIN verification', async () => {
      pinService.verifyPin.mockRejectedValue(new BadRequestException('Invalid PIN'));

      await expect(
        service.execute('user-uuid', { amountUsdc: 10, bankAccountId: 'bank-uuid', pin: '0000', previewRate: '1600' }),
      ).rejects.toThrow(BadRequestException);

      expect(pinService.verifyPin).toHaveBeenCalledWith('user-uuid', '0000');
    });

    it('deducts USDC before initiating NGN transfer', async () => {
      setupMocks();
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { recipient_code: 'RCP_123' } }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { transfer_code: 'TRF_123' } }) });

      await service.execute('user-uuid', { amountUsdc: 10, bankAccountId: 'bank-uuid', pin: '1234', previewRate: '1600' });

      expect(sorobanService.withdraw).toHaveBeenCalledWith('alice', '10.00000000');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('throws when bank account not found', async () => {
      pinService.verifyPin.mockResolvedValue(undefined);
      userRepo.findOne.mockResolvedValue(mockUser());
      bankAccountRepo.findOne.mockResolvedValue(null);

      await expect(
        service.execute('user-uuid', { amountUsdc: 10, bankAccountId: 'bad-uuid', pin: '1234', previewRate: '1600' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('enforces minimum amount', async () => {
      await expect(
        service.execute('user-uuid', { amountUsdc: 0.5, bankAccountId: 'bank-uuid', pin: '1234', previewRate: '1600' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('enforces tier-based maximum amount', async () => {
      pinService.verifyPin.mockResolvedValue(undefined);
      userRepo.findOne.mockResolvedValue(mockUser());
      bankAccountRepo.findOne.mockResolvedValue(mockBankAccount());
      tierConfigRepo.findOne.mockResolvedValue({ ...mockTierConfig(), maxSingleWithdrawalUsdc: '100.00000000' });
      ratesService.getRate.mockResolvedValue({ rate: '1600', fetchedAt: new Date(), source: 'bybit', isStale: false });
      feeConfigRepo.findOne.mockResolvedValue(mockFeeConfig());

      await expect(
        service.execute('user-uuid', { amountUsdc: 200, bankAccountId: 'bank-uuid', pin: '1234', previewRate: '1600' }),
      ).rejects.toThrow('Amount exceeds your tier limit');
    });

    it('throws 400 when rate changed more than 2% between preview and execute', async () => {
      pinService.verifyPin.mockResolvedValue(undefined);
      userRepo.findOne.mockResolvedValue(mockUser());
      bankAccountRepo.findOne.mockResolvedValue(mockBankAccount());
      tierConfigRepo.findOne.mockResolvedValue(mockTierConfig());
      // Current rate is 1641 — 2.56% above preview rate of 1600
      ratesService.getRate.mockResolvedValue({ rate: '1641', fetchedAt: new Date(), source: 'bybit', isStale: false });
      feeConfigRepo.findOne.mockResolvedValue(mockFeeConfig());

      await expect(
        service.execute('user-uuid', { amountUsdc: 10, bankAccountId: 'bank-uuid', pin: '1234', previewRate: '1600' }),
      ).rejects.toThrow('Rate has changed significantly. Please preview again.');
    });

    it('refunds USDC when Paystack transfer fails', async () => {
      setupMocks();
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
      sorobanService.deposit.mockResolvedValue(undefined);

      await expect(
        service.execute('user-uuid', { amountUsdc: 10, bankAccountId: 'bank-uuid', pin: '1234', previewRate: '1600' }),
      ).rejects.toThrow('NGN transfer failed');

      expect(sorobanService.deposit).toHaveBeenCalledWith('alice', '10.00000000');
      expect(offRampRepo.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ status: OffRampStatus.REFUNDED }),
      );
    });

    it('creates failed Settlement when USDC deduction fails', async () => {
      pinService.verifyPin.mockResolvedValue(undefined);
      userRepo.findOne.mockResolvedValue(mockUser());
      bankAccountRepo.findOne.mockResolvedValue(mockBankAccount());
      tierConfigRepo.findOne.mockResolvedValue(mockTierConfig());
      ratesService.getRate.mockResolvedValue({ rate: '1600', fetchedAt: new Date(), source: 'bybit', isStale: false });
      feeConfigRepo.findOne.mockResolvedValue(mockFeeConfig());
      const offRamp = mockOffRamp();
      offRampRepo.create.mockReturnValue(offRamp);
      offRampRepo.save.mockResolvedValue(offRamp);
      offRampRepo.update.mockResolvedValue(undefined);
      sorobanService.withdraw.mockRejectedValue(new Error('Insufficient balance'));

      await expect(
        service.execute('user-uuid', { amountUsdc: 10, bankAccountId: 'bank-uuid', pin: '1234', previewRate: '1600' }),
      ).rejects.toThrow('Failed to deduct USDC');

      expect(offRampRepo.update).toHaveBeenCalledWith(
        offRamp.id,
        expect.objectContaining({ status: OffRampStatus.FAILED }),
      );
    });
  });

  // ── computeFee ───────────────────────────────────────────────────────────────

  describe('computeFee', () => {
    it('computes fee correctly with base rate', () => {
      const { feeUsdc, netAmountUsdc } = service.computeFee(100, mockFeeConfig());
      expect(feeUsdc).toBe(1); // 1% of 100
      expect(netAmountUsdc).toBe(99);
    });

    it('applies minimum fee', () => {
      const { feeUsdc } = service.computeFee(10, mockFeeConfig()); // 1% = 0.1, min = 0.5
      expect(feeUsdc).toBe(0.5);
    });

    it('applies maximum fee cap', () => {
      const { feeUsdc } = service.computeFee(1000, mockFeeConfig()); // 1% = 10, max = 5
      expect(feeUsdc).toBe(5);
    });

    it('returns zero fee when no config', () => {
      const { feeUsdc, netAmountUsdc } = service.computeFee(100, null);
      expect(feeUsdc).toBe(0);
      expect(netAmountUsdc).toBe(100);
    });
  });

  // ── getStatus ────────────────────────────────────────────────────────────────

  describe('getStatus', () => {
    it('returns off-ramp status', async () => {
      offRampRepo.findOne.mockResolvedValue(mockOffRamp());

      const result = await service.getStatus('user-uuid', 'OFFRAMP-ABC123');
      expect(result.reference).toBe('OFFRAMP-ABC123');
    });

    it('throws NotFoundException for unknown reference', async () => {
      offRampRepo.findOne.mockResolvedValue(null);
      await expect(service.getStatus('user-uuid', 'UNKNOWN')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getHistory ───────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('returns paginated off-ramp history', async () => {
      offRampRepo.findAndCount.mockResolvedValue([[mockOffRamp()], 1]);

      const result = await service.getHistory('user-uuid', 1, 20);
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });
});
