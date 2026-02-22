import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettlementConfigService } from './settlement-config.service';
import { SettlementRule } from '../database/entities/settlement-rule.entity';
import { Settlement } from '../settlement/entities/settlement.entity';
import { AuditLogService } from '../audit/audit-log.service';
import { DataSource } from 'typeorm';

describe('SettlementConfigService', () => {
  let service: SettlementConfigService;
  let ruleRepository: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementConfigService,
        {
          provide: getRepositoryToken(SettlementRule),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            softRemove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Settlement),
          useValue: {
            count: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SettlementConfigService>(SettlementConfigService);
    ruleRepository = module.get(getRepositoryToken(SettlementRule));
  });

  describe('test', () => {
    it('should match a rule based on usdAmount condition', async () => {
      const mockRule: Partial<SettlementRule> = {
        id: 'rule-1',
        name: 'High Value Rule',
        priority: 1,
        isEnabled: true,
        conditions: [
          {
            field: 'transaction.usdAmount',
            operator: 'gte',
            value: 1000,
          },
        ],
        actions: {
          liquidityProvider: 'provider-a',
        },
      };

      ruleRepository.find.mockResolvedValue([mockRule]);

      const testDto = {
        sampleTransaction: {
          usdAmount: 1500,
          chain: 'ethereum',
          tokenSymbol: 'USDC',
        },
        sampleMerchant: {
          tier: 'ENTERPRISE',
          country: 'US',
          settlementCurrency: 'USD',
        },
      };

      const result = await service.test(testDto);

      expect(result.matchedRule?.id).toBe('rule-1');
      expect(result.action?.liquidityProvider).toBe('provider-a');
      expect(result.evaluationTrace[0].matched).toBe(true);
    });

    it('should not match if condition fails', async () => {
      const mockRule: Partial<SettlementRule> = {
        id: 'rule-2',
        name: 'Low Value Rule',
        priority: 1,
        isEnabled: true,
        conditions: [
          {
            field: 'transaction.usdAmount',
            operator: 'lt',
            value: 500,
          },
        ],
        actions: {
          liquidityProvider: 'provider-b',
        },
      };

      ruleRepository.find.mockResolvedValue([mockRule]);

      const testDto = {
        sampleTransaction: {
          usdAmount: 1000,
          chain: 'ethereum',
          tokenSymbol: 'USDC',
        },
        sampleMerchant: {
          tier: 'GROWTH',
          country: 'GB',
          settlementCurrency: 'GBP',
        },
      };

      const result = await service.test(testDto);

      expect(result.matchedRule).toBeNull();
      expect(result.evaluationTrace[0].matched).toBe(false);
      expect(result.evaluationTrace[0].reason).toContain('transaction.usdAmount 1000 lt 500 failed');
    });

    it('should handle "in" operator correctly', async () => {
      const mockRule: Partial<SettlementRule> = {
        id: 'rule-3',
        name: 'Country Rule',
        priority: 1,
        isEnabled: true,
        conditions: [
          {
            field: 'merchant.country',
            operator: 'in',
            value: ['US', 'CA'],
          },
        ],
        actions: {
          liquidityProvider: 'north-america-provider',
        },
      };

      ruleRepository.find.mockResolvedValue([mockRule]);

      const testDto = {
        sampleTransaction: {
          usdAmount: 100,
          chain: 'polygon',
          tokenSymbol: 'USDT',
        },
        sampleMerchant: {
          tier: 'STARTER',
          country: 'US',
          settlementCurrency: 'USD',
        },
      };

      const result = await service.test(testDto);

      expect(result.matchedRule?.id).toBe('rule-3');
      expect(result.evaluationTrace[0].matched).toBe(true);
    });
  });
});
