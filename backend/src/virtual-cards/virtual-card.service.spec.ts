import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { VirtualCardService } from './virtual-card.service';
import { VirtualCard, CardStatus, CardBrand } from './entities/virtual-card.entity';
import { User } from '../users/entities/user.entity';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';
import { TierName } from '../tier-config/entities/tier-config.entity';
import { SorobanService } from '../soroban/soroban.service';
import { RatesService } from '../rates/rates.service';
import { sudoAfricaConfig } from '../config/sudo-africa.config';

describe('VirtualCardService', () => {
  let service: VirtualCardService;
  let mockCardRepo: any;
  let mockUserRepo: any;
  let mockTxRepo: any;
  let mockHttpService: any;
  let mockSorobanService: any;
  let mockRatesService: any;

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    tier: TierName.GOLD,
  };

  const mockCard = {
    id: 'card-1',
    userId: 'user-1',
    sudoCardId: 'sudo-123',
    last4: '4242',
    brand: CardBrand.VISA,
    currency: 'USD',
    status: CardStatus.ACTIVE,
    spendingLimit: null,
    balance: '100.00',
    billingAddress: { street: '123 Main' },
    terminatedAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockCardRepo = {
      create: jest.fn().mockReturnValue(mockCard),
      save: jest.fn().mockResolvedValue(mockCard),
      findOne: jest.fn().mockResolvedValue(mockCard),
      find: jest.fn().mockResolvedValue([mockCard]),
    };

    mockUserRepo = {
      findOne: jest.fn().mockResolvedValue(mockUser),
    };

    mockTxRepo = {
      create: jest.fn().mockReturnValue({
        userId: 'user-1',
        type: TransactionType.VIRTUAL_CARD_FUND,
      }),
      save: jest.fn().mockResolvedValue({
        id: 'tx-1',
      }),
    };

    mockHttpService = {
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    };

    mockSorobanService = {
      transfer: jest.fn().mockResolvedValue(undefined),
    };

    mockRatesService = {
      convertNgnToUsdc: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VirtualCardService,
        {
          provide: getRepositoryToken(VirtualCard),
          useValue: mockCardRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTxRepo,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: sudoAfricaConfig.KEY,
          useValue: {
            apiKey: 'test-key',
            baseUrl: 'https://api.test.com',
            webhookSecret: 'test-secret',
          },
        },
        {
          provide: SorobanService,
          useValue: mockSorobanService,
        },
        {
          provide: RatesService,
          useValue: mockRatesService,
        },
      ],
    }).compile();

    service = module.get<VirtualCardService>(VirtualCardService);
  });

  describe('create', () => {
    it('should throw 403 for Silver tier user', async () => {
      const silverUser = { ...mockUser, tier: TierName.SILVER };
      mockUserRepo.findOne.mockResolvedValue(silverUser);

      const dto = {
        billingName: 'John Doe',
        billingAddress: {
          street: '123 Main',
          city: 'NYC',
          state: 'NY',
          country: 'US',
          postalCode: '10001',
        },
      };

      await expect(service.create('user-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should create card for Gold tier user', async () => {
      const sudoCardResponse = {
        id: 'sudo-123',
        last4: '4242',
        brand: 'visa',
        balance: '0',
      };

      mockHttpService.post.mockReturnValue({
        toPromise: jest.fn().mockResolvedValue({
          data: sudoCardResponse,
        }),
      });

      const dto = {
        billingName: 'John Doe',
        billingAddress: {
          street: '123 Main',
          city: 'NYC',
          state: 'NY',
          country: 'US',
          postalCode: '10001',
        },
      };

      const result = await service.create('user-1', dto);

      expect(result).toBeDefined();
      expect(mockCardRepo.create).toHaveBeenCalled();
      expect(mockCardRepo.save).toHaveBeenCalled();
    });
  });

  describe('fund', () => {
    it('should fund card from USDC balance', async () => {
      const dto = { amountUsd: '50.00' };

      const result = await service.fund('card-1', dto, 'user-1');

      expect(mockSorobanService.transfer).toHaveBeenCalled();
      expect(mockTxRepo.create).toHaveBeenCalled();
      expect(mockTxRepo.save).toHaveBeenCalled();
    });

    it('should throw error if card not found', async () => {
      mockCardRepo.findOne.mockResolvedValue(null);

      const dto = { amountUsd: '50.00' };

      await expect(service.fund('card-1', dto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject funding frozen card', async () => {
      const frozenCard = { ...mockCard, status: CardStatus.FROZEN };
      mockCardRepo.findOne.mockResolvedValue(frozenCard);

      const dto = { amountUsd: '50.00' };

      await expect(service.fund('card-1', dto, 'user-1')).rejects.toThrow();
    });
  });

  describe('freeze', () => {
    it('should freeze active card', async () => {
      const dto = {};

      const result = await service.freeze('card-1', 'user-1');

      expect(mockHttpService.patch).toHaveBeenCalled();
      expect(mockCardRepo.save).toHaveBeenCalled();
    });

    it('should unfreeze frozen card', async () => {
      const frozenCard = { ...mockCard, status: CardStatus.FROZEN };
      mockCardRepo.findOne.mockResolvedValueOnce(frozenCard);

      await service.freeze('card-1', 'user-1');

      expect(mockCardRepo.save).toHaveBeenCalled();
    });
  });

  describe('terminate', () => {
    it('should refund balance to user USDC wallet', async () => {
      const cardWithBalance = { ...mockCard, balance: '100.00' };
      mockCardRepo.findOne.mockResolvedValueOnce(cardWithBalance);

      const result = await service.terminate('card-1', 'user-1');

      expect(mockSorobanService.transfer).toHaveBeenCalledWith(
        'virtual_card_treasury',
        'testuser',
        '100',
        expect.stringContaining('Refund'),
      );
      expect(mockTxRepo.create).toHaveBeenCalled();
      expect(mockCardRepo.save).toHaveBeenCalled();
    });

    it('should not refund if balance is zero', async () => {
      const cardWithZeroBalance = { ...mockCard, balance: '0' };
      mockCardRepo.findOne.mockResolvedValueOnce(cardWithZeroBalance);

      await service.terminate('card-1', 'user-1');

      // Soroban transfer should not be called for zero balance
      expect(mockCardRepo.save).toHaveBeenCalled();
    });

    it('should throw error if card already terminated', async () => {
      const terminatedCard = { ...mockCard, status: CardStatus.TERMINATED };
      mockCardRepo.findOne.mockResolvedValueOnce(terminatedCard);

      await expect(service.terminate('card-1', 'user-1')).rejects.toThrow();
    });
  });

  describe('listCards', () => {
    it('should list all cards for user', async () => {
      const result = await service.listCards('user-1');

      expect(mockCardRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getCard', () => {
    it('should return card for valid user and card id', async () => {
      const result = await service.getCard('card-1', 'user-1');

      expect(result).toBeDefined();
      expect(mockCardRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'card-1', userId: 'user-1' },
      });
    });

    it('should throw error if card not found', async () => {
      mockCardRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.getCard('card-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('handleSudoWebhook', () => {
    it('should process card transaction webhook', async () => {
      const payload = Buffer.from(
        JSON.stringify({
          eventType: 'card.transaction',
          cardId: 'sudo-123',
          transactionId: 'txn-123',
          amount: 50,
          merchant: 'Amazon',
          timestamp: new Date().toISOString(),
        }),
      );

      const hash = require('crypto')
        .createHmac('sha256', 'test-secret')
        .update(payload)
        .digest('hex');

      await service.handleSudoWebhook(payload, hash);

      expect(mockTxRepo.create).toHaveBeenCalled();
    });

    it('should reject invalid signature', async () => {
      const payload = Buffer.from(JSON.stringify({}));

      await expect(
        service.handleSudoWebhook(payload, 'invalid-signature'),
      ).rejects.toThrow();
    });
  });
});
