import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getQueueToken } from '@nestjs/bull';
import { ContractEventListenerService } from './contract-event-listener.service';
import { ContractEventLog, ContractEventType, ReconciliationAlert } from '../entities';
import { CacheService } from '../../cache/cache.service';
import { SorobanService } from '../soroban.service';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { PayLink } from '../../paylink/entities/paylink.entity';

describe('ContractEventListenerService', () => {
  let service: ContractEventListenerService;
  let eventLogRepo: jest.Mocked<Repository<ContractEventLog>>;
  let reconciliationAlertRepo: jest.Mocked<Repository<ReconciliationAlert>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let transactionRepo: jest.Mocked<Repository<Transaction>>;
  let payLinkRepo: jest.Mocked<Repository<PayLink>>;
  let cacheService: jest.Mocked<CacheService>;
  let sorobanService: jest.Mocked<SorobanService>;
  let queue: any;

  const mockUser = {
    id: 'user-1',
    username: 'john_doe',
    email: 'john@example.com',
  } as User;

  const mockPayLink = {
    id: 'paylink-1',
    title: 'Invoice',
  } as PayLink;

  beforeEach(async () => {
    const mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractEventListenerService,
        {
          provide: getRepositoryToken(ContractEventLog),
          useValue: {
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ReconciliationAlert),
          useValue: {
            save: jest.fn(),
            create: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PayLink),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getQueueToken('blockchain-sync'),
          useValue: mockQueue,
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: SorobanService,
          useValue: {
            getEvents: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContractEventListenerService>(ContractEventListenerService);
    eventLogRepo = module.get(getRepositoryToken(ContractEventLog));
    reconciliationAlertRepo = module.get(getRepositoryToken(ReconciliationAlert));
    userRepo = module.get(getRepositoryToken(User));
    transactionRepo = module.get(getRepositoryToken(Transaction));
    payLinkRepo = module.get(getRepositoryToken(PayLink));
    cacheService = module.get(CacheService);
    sorobanService = module.get(SorobanService);
    queue = module.get(getQueueToken('blockchain-sync'));
  });

  describe('processEvent', () => {
    it('should skip already-processed events (idempotency)', async () => {
      const event = {
        id: 'evt-1',
        txHash: 'tx123',
        eventIndex: 0,
        type: 'deposit',
        ledger: 100,
        data: {
          username: 'john_doe',
          amount: '100',
          balance: '500',
        },
      };

      // Mock cache to return true (already processed)
      cacheService.get.mockResolvedValueOnce(true);

      // Should not save if already processed
      await service['processEvent'](event as any);

      expect(eventLogRepo.save).not.toHaveBeenCalled();
    });

    it('should process and log deposit event', async () => {
      const event = {
        id: 'evt-1',
        txHash: 'tx123',
        eventIndex: 0,
        type: 'deposit',
        ledger: 100,
        data: {
          username: 'john_doe',
          amount: '100',
          balance: '500',
        },
      };

      cacheService.get.mockResolvedValueOnce(false); // Not processed
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      transactionRepo.findOne.mockResolvedValueOnce(null); // No existing tx
      cacheService.set.mockResolvedValueOnce(undefined);
      eventLogRepo.save.mockResolvedValueOnce(event);

      await service['processEvent'](event as any);

      // Should mark as processed
      expect(cacheService.set).toHaveBeenCalledWith(
        'contract:events:processed:tx123:0',
        true,
        expect.any(Number),
      );

      // Should save event log
      expect(eventLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          txHash: 'tx123',
          eventIndex: 0,
          eventType: ContractEventType.DEPOSIT,
          data: event.data,
          ledger: 100,
        }),
      );
    });

    it('should process transfer event and check both users exist', async () => {
      const event = {
        id: 'evt-2',
        txHash: 'tx124',
        eventIndex: 0,
        type: 'transfer',
        ledger: 101,
        data: {
          from: 'john_doe',
          to: 'jane_doe',
          amount: '50',
          fromBalance: '450',
          toBalance: '550',
        },
      };

      cacheService.get.mockResolvedValueOnce(false);
      userRepo.findOne
        .mockResolvedValueOnce(mockUser) // from user
        .mockResolvedValueOnce(mockUser); // to user
      transactionRepo.findOne.mockResolvedValueOnce(null);
      cacheService.set.mockResolvedValueOnce(undefined);
      eventLogRepo.save.mockResolvedValueOnce(event);

      await service['processEvent'](event as any);

      expect(eventLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: ContractEventType.TRANSFER,
        }),
      );
    });

    it('should create reconciliation alert if transfer user not found', async () => {
      const event = {
        id: 'evt-3',
        txHash: 'tx125',
        eventIndex: 0,
        type: 'transfer',
        ledger: 102,
        data: {
          from: 'john_doe',
          to: 'unknown_user',
          amount: '50',
        },
      };

      cacheService.get.mockResolvedValueOnce(false);
      userRepo.findOne.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(null); // Second user not found
      reconciliationAlertRepo.create.mockReturnValueOnce({
        userId: '',
        discrepancyType: 'missing_user_transfer',
        message: expect.any(String),
        data: event.data,
      } as any);
      cacheService.set.mockResolvedValueOnce(undefined);
      eventLogRepo.save.mockResolvedValueOnce(event);

      await service['processEvent'](event as any);

      expect(reconciliationAlertRepo.save).toHaveBeenCalled();
      expect(reconciliationAlertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discrepancyType: 'missing_user_transfer',
        }),
      );
    });

    it('should process paylink_paid event', async () => {
      const event = {
        id: 'evt-4',
        txHash: 'tx126',
        eventIndex: 0,
        type: 'paylink_paid',
        ledger: 103,
        data: {
          payer: 'john_doe',
          payLinkId: 'paylink-1',
          amount: '100',
        },
      };

      cacheService.get.mockResolvedValueOnce(false);
      payLinkRepo.findOne.mockResolvedValueOnce(mockPayLink);
      cacheService.set.mockResolvedValueOnce(undefined);
      eventLogRepo.save.mockResolvedValueOnce(event);

      await service['processEvent'](event as any);

      expect(eventLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: ContractEventType.PAYLINK_PAID,
        }),
      );
    });

    it('should create reconciliation alert for missing paylink', async () => {
      const event = {
        id: 'evt-5',
        txHash: 'tx127',
        eventIndex: 0,
        type: 'paylink_paid',
        ledger: 104,
        data: {
          payer: 'john_doe',
          payLinkId: 'missing-paylink',
          amount: '100',
        },
      };

      cacheService.get.mockResolvedValueOnce(false);
      payLinkRepo.findOne.mockResolvedValueOnce(null);
      reconciliationAlertRepo.create.mockReturnValueOnce({
        userId: '',
        discrepancyType: 'missing_paylink',
        message: expect.any(String),
      } as any);
      cacheService.set.mockResolvedValueOnce(undefined);
      eventLogRepo.save.mockResolvedValueOnce(event);

      await service['processEvent'](event as any);

      expect(reconciliationAlertRepo.save).toHaveBeenCalled();
    });

    it('should process yield_credited event', async () => {
      const event = {
        id: 'evt-6',
        txHash: 'tx128',
        eventIndex: 0,
        type: 'yield_credited',
        ledger: 105,
        data: {
          username: 'john_doe',
          yield: '10',
          newBalance: '510',
        },
      };

      cacheService.get.mockResolvedValueOnce(false);
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      cacheService.set.mockResolvedValueOnce(undefined);
      eventLogRepo.save.mockResolvedValueOnce(event);

      await service['processEvent'](event as any);

      expect(eventLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: ContractEventType.YIELD_CREDITED,
        }),
      );
    });

    it('should process withdrawal event', async () => {
      const event = {
        id: 'evt-7',
        txHash: 'tx129',
        eventIndex: 0,
        type: 'withdrawal',
        ledger: 106,
        data: {
          username: 'john_doe',
          amount: '100',
          txHash: 'blockchain-tx-hash',
          balance: '400',
        },
      };

      cacheService.get.mockResolvedValueOnce(false);
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      cacheService.set.mockResolvedValueOnce(undefined);
      eventLogRepo.save.mockResolvedValueOnce(event);

      await service['processEvent'](event as any);

      expect(eventLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: ContractEventType.WITHDRAWAL,
        }),
      );
    });
  });

  describe('Redis - Last Processed Ledger', () => {
    it('should get last processed ledger from Redis', async () => {
      cacheService.get.mockResolvedValueOnce(150);

      const ledger = await service['getLastProcessedLedger']();

      expect(ledger).toBe(150);
      expect(cacheService.get).toHaveBeenCalledWith('contract:last_ledger');
    });

    it('should return 0 if no ledger stored in Redis', async () => {
      cacheService.get.mockResolvedValueOnce(null);

      const ledger = await service['getLastProcessedLedger']();

      expect(ledger).toBe(0);
    });

    it('should set last processed ledger in Redis', async () => {
      cacheService.set.mockResolvedValueOnce(undefined);

      await service['setLastProcessedLedger'](200);

      expect(cacheService.set).toHaveBeenCalledWith(
        'contract:last_ledger',
        200,
        expect.any(Number),
      );
    });
  });

  describe('Event Idempotency', () => {
    it('should mark event as processed with 7-day TTL', async () => {
      cacheService.set.mockResolvedValueOnce(undefined);

      await service['markEventProcessed']('tx123:0');

      expect(cacheService.set).toHaveBeenCalledWith(
        'contract:events:processed:tx123:0',
        true,
        7 * 24 * 60 * 60, // 7 days
      );
    });
  });

  describe('Admin Endpoints', () => {
    describe('getContractEvents', () => {
      it('should fetch contract events with pagination', async () => {
        const mockEvents = [
          {
            id: '1',
            txHash: 'tx1',
            eventIndex: 0,
            eventType: ContractEventType.DEPOSIT,
          },
        ] as any;

        const mockQueryBuilder = {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValueOnce([mockEvents, 5]),
        };

        eventLogRepo.createQueryBuilder.mockReturnValueOnce(mockQueryBuilder);

        const result = await service.getContractEvents(1, 20);

        expect(result.data).toEqual(mockEvents);
        expect(result.total).toBe(5);
        expect(result.page).toBe(1);
        expect(result.limit).toBe(20);
      });

      it('should filter by event type', async () => {
        const mockEvents = [] as any;
        const mockQueryBuilder = {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValueOnce([mockEvents, 0]),
        };

        eventLogRepo.createQueryBuilder.mockReturnValueOnce(mockQueryBuilder);

        await service.getContractEvents(1, 20, ContractEventType.DEPOSIT);

        expect(mockQueryBuilder.where).toHaveBeenCalledWith('event.eventType = :eventType', {
          eventType: ContractEventType.DEPOSIT,
        });
      });
    });

    describe('getReconciliationAlerts', () => {
      it('should fetch reconciliation alerts with unresolved filter', async () => {
        const mockAlerts = [
          {
            id: '1',
            message: 'Balance mismatch',
            isResolved: false,
          },
        ] as any;

        const mockQueryBuilder = {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValueOnce([mockAlerts, 3]),
        };

        reconciliationAlertRepo.createQueryBuilder.mockReturnValueOnce(mockQueryBuilder);

        const result = await service.getReconciliationAlerts(1, 20, true);

        expect(result.data).toEqual(mockAlerts);
        expect(result.total).toBe(3);
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('alert.isResolved = :isResolved', {
          isResolved: false,
        });
      });

      it('should fetch all alerts when unresolved=false', async () => {
        const mockAlerts = [] as any;
        const mockQueryBuilder = {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValueOnce([mockAlerts, 0]),
        };

        reconciliationAlertRepo.createQueryBuilder.mockReturnValueOnce(mockQueryBuilder);

        await service.getReconciliationAlerts(1, 20, false);

        expect(mockQueryBuilder.where).not.toHaveBeenCalled();
      });
    });

    describe('resolveAlert', () => {
      it('should update alert as resolved', async () => {
        reconciliationAlertRepo.update.mockResolvedValueOnce({ affected: 1 } as any);

        await service.resolveAlert('alert-1', 'Manual reconciliation completed');

        expect(reconciliationAlertRepo.update).toHaveBeenCalledWith(
          { id: 'alert-1' },
          {
            isResolved: true,
            resolvedNote: 'Manual reconciliation completed',
          },
        );
      });
    });
  });
});
