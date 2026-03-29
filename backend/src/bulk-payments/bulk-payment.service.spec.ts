import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BulkPaymentService } from '../bulk-payment.service';
import { BulkPayment, BulkPaymentStatus } from '../entities/bulk-payment.entity';
import { BulkPaymentRow, BulkPaymentRowStatus } from '../entities/bulk-payment-row.entity';
import { R2Service } from '../../r2/r2.service';
import { UsersService } from '../../users/users.service';
import { BalanceService } from '../../balance/balance.service';
import { PinService } from '../../pin/pin.service';
import { TierService } from '../../tier-config/tier.service';
import { TierName } from '../../tier-config/entities/tier-config.entity';

describe('BulkPaymentService', () => {
  let service: BulkPaymentService;
  let bulkPaymentRepo: Repository<BulkPayment>;
  let bulkPaymentRowRepo: Repository<BulkPaymentRow>;
  let r2Service: R2Service;
  let usersService: UsersService;
  let balanceService: BalanceService;
  let pinService: PinService;
  let tierService: TierService;

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    tier: TierName.GOLD,
  };

  const mockBalance = {
    totalUsdc: '1000.00',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkPaymentService,
        {
          provide: getRepositoryToken(BulkPayment),
          useClass: Repository,
        },
        {
          provide: getRepositoryToken(BulkPaymentRow),
          useClass: Repository,
        },
        {
          provide: R2Service,
          useValue: {
            uploadBuffer: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
            findByUsername: jest.fn(),
          },
        },
        {
          provide: BalanceService,
          useValue: {
            getBalance: jest.fn(),
          },
        },
        {
          provide: PinService,
          useValue: {
            verifyPin: jest.fn(),
          },
        },
        {
          provide: TierService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<BulkPaymentService>(BulkPaymentService);
    bulkPaymentRepo = module.get<Repository<BulkPayment>>(getRepositoryToken(BulkPayment));
    bulkPaymentRowRepo = module.get<Repository<BulkPaymentRow>>(getRepositoryToken(BulkPaymentRow));
    r2Service = module.get<R2Service>(R2Service);
    usersService = module.get<UsersService>(UsersService);
    balanceService = module.get<BalanceService>(BalanceService);
    pinService = module.get<PinService>(PinService);
    tierService = module.get<TierService>(TierService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('CSV validation', () => {
    it('should reject invalid amounts', async () => {
      const csvBuffer = Buffer.from('username,amount_usdc\nuser1,invalid_amount');

      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as any);
      jest.spyOn(pinService, 'verifyPin').mockResolvedValue();
      jest.spyOn(balanceService, 'getBalance').mockResolvedValue(mockBalance as any);

      await expect(
        service.upload('user-1', csvBuffer, { label: 'Test', pin: '1234' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject amounts <= 0', async () => {
      const csvBuffer = Buffer.from('username,amount_usdc\ntestuser,0');

      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as any);
      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(mockUser as any);
      jest.spyOn(pinService, 'verifyPin').mockResolvedValue();
      jest.spyOn(balanceService, 'getBalance').mockResolvedValue(mockBalance as any);

      await expect(
        service.upload('user-1', csvBuffer, { label: 'Test', pin: '1234' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-existent usernames', async () => {
      const csvBuffer = Buffer.from('username,amount_usdc\nnonexistent,10.00');

      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as any);
      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(null);
      jest.spyOn(pinService, 'verifyPin').mockResolvedValue();
      jest.spyOn(balanceService, 'getBalance').mockResolvedValue(mockBalance as any);

      await expect(
        service.upload('user-1', csvBuffer, { label: 'Test', pin: '1234' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject over-balance total', async () => {
      const csvBuffer = Buffer.from('username,amount_usdc\ntestuser,2000.00');

      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as any);
      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(mockUser as any);
      jest.spyOn(pinService, 'verifyPin').mockResolvedValue();
      jest.spyOn(balanceService, 'getBalance').mockResolvedValue({ totalUsdc: '1000.00' } as any);

      await expect(
        service.upload('user-1', csvBuffer, { label: 'Test', pin: '1234' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject Silver tier users', async () => {
      const csvBuffer = Buffer.from('username,amount_usdc\ntestuser,10.00');

      jest.spyOn(usersService, 'findById').mockResolvedValue({ ...mockUser, tier: TierName.SILVER } as any);
      jest.spyOn(pinService, 'verifyPin').mockResolvedValue();

      await expect(
        service.upload('user-1', csvBuffer, { label: 'Test', pin: '1234' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('successful upload', () => {
    it('should create bulk payment and rows', async () => {
      const csvBuffer = Buffer.from('username,amount_usdc,note\ntestuser,10.00,Test payment');

      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as any);
      jest.spyOn(usersService, 'findByUsername').mockResolvedValue(mockUser as any);
      jest.spyOn(pinService, 'verifyPin').mockResolvedValue();
      jest.spyOn(balanceService, 'getBalance').mockResolvedValue(mockBalance as any);
      jest.spyOn(r2Service, 'uploadBuffer').mockResolvedValue();
      jest.spyOn(bulkPaymentRepo, 'create').mockReturnValue({
        id: 'bulk-1',
        initiatedBy: 'user-1',
        label: 'Test',
        csvKey: 'key',
        totalRows: 1,
        totalAmountUsdc: '10.00',
        status: BulkPaymentStatus.PENDING,
      } as BulkPayment);
      jest.spyOn(bulkPaymentRepo, 'save').mockResolvedValue({} as BulkPayment);
      jest.spyOn(bulkPaymentRowRepo, 'create').mockReturnValue({} as BulkPaymentRow);
      jest.spyOn(bulkPaymentRowRepo, 'save').mockResolvedValue([]);

      const result = await service.upload('user-1', csvBuffer, { label: 'Test', pin: '1234' });

      expect(result.bulkPayment).toBeDefined();
      expect(result.validation.validRows).toBe(1);
      expect(result.validation.totalAmountUsdc).toBe('10.00');
    });
  });
});