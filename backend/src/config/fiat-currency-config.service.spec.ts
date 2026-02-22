import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FiatCurrencyConfigService } from './fiat-currency-config.service';
import { FiatCurrencyConfig } from '../database/entities/fiat-currency-config.entity';
import { Merchant } from '../database/entities/merchant.entity';
import { AuditLogService } from '../audit/audit-log.service';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RateSource } from '../database/entities/fiat-currency-config.entity';

describe('FiatCurrencyConfigService', () => {
  let service: FiatCurrencyConfigService;
  let currencyRepo: any;
  let merchantRepo: any;
  let auditLogService: any;
  let exchangeRateService: any;

  beforeEach(async () => {
    currencyRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    merchantRepo = {
      createQueryBuilder: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    auditLogService = {
      log: jest.fn(),
    };

    exchangeRateService = {
      getRate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FiatCurrencyConfigService,
        {
          provide: getRepositoryToken(FiatCurrencyConfig),
          useValue: currencyRepo,
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: merchantRepo,
        },
        {
          provide: AuditLogService,
          useValue: auditLogService,
        },
        {
          provide: ExchangeRateService,
          useValue: exchangeRateService,
        },
      ],
    }).compile();

    service = module.get<FiatCurrencyConfigService>(FiatCurrencyConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByCode', () => {
    it('should return config if found', async () => {
      const mockConfig = { currencyCode: 'USD' };
      currencyRepo.findOne.mockResolvedValue(mockConfig);

      const result = await service.findByCode('USD');
      expect(result).toBe(mockConfig);
    });

    it('should throw NotFoundException if not found', async () => {
      currencyRepo.findOne.mockResolvedValue(null);
      await expect(service.findByCode('GBP')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should handle isDefault uniqueness', async () => {
      const mockConfig = { currencyCode: 'USD', isDefault: false };
      currencyRepo.findOne.mockResolvedValue(mockConfig);
      currencyRepo.save.mockResolvedValue({ ...mockConfig, isDefault: true });

      await service.update('USD', { isDefault: true });

      expect(currencyRepo.update).toHaveBeenCalledWith(
        { currencyCode: expect.anything() },
        { isDefault: false },
      );
    });

    it('should throw ConflictException when disabling currency used by merchants', async () => {
      const mockConfig = { currencyCode: 'NGN', isEnabled: true };
      currencyRepo.findOne.mockResolvedValue(mockConfig);
      merchantRepo.getMany.mockResolvedValue([{ id: 'm1', name: 'Merchant 1' }]);

      await expect(service.update('NGN', { isEnabled: false })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('validateOperatingHours', () => {
    it('should validate correct format', () => {
      expect(() =>
        service.validateOperatingHours({ monday: '09:00-17:00' }),
      ).not.toThrow();
    });

    it('should throw error for invalid format', () => {
      expect(() =>
        service.validateOperatingHours({ monday: '9:00-17:00' }),
      ).toThrow();
      expect(() =>
        service.validateOperatingHours({ monday: '09:00 - 17:00' }),
      ).toThrow();
    });
  });
});
