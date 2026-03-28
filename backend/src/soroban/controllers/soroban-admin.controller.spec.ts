import { Test, TestingModule } from '@nestjs/testing';
import { SorobanAdminController } from './soroban-admin.controller';
import { ContractEventListenerService } from '../services/contract-event-listener.service';
import { ContractEventType } from '../entities/contract-event-log.entity';

describe('SorobanAdminController', () => {
  let controller: SorobanAdminController;
  let contractEventListenerService: jest.Mocked<ContractEventListenerService>;

  const mockContractEvent = {
    id: 'evt-1',
    txHash: 'tx123',
    eventIndex: 0,
    eventType: ContractEventType.DEPOSIT,
    data: { username: 'john_doe', amount: '100' },
    ledger: 100,
    createdAt: new Date(),
  };

  const mockReconciliationAlert = {
    id: 'alert-1',
    userId: 'user-1',
    discrepancyType: 'balance_mismatch',
    message: 'Balance mismatch detected',
    isResolved: false,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SorobanAdminController],
      providers: [
        {
          provide: ContractEventListenerService,
          useValue: {
            getContractEvents: jest.fn(),
            getReconciliationAlerts: jest.fn(),
            resolveAlert: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SorobanAdminController>(SorobanAdminController);
    contractEventListenerService = module.get(
      ContractEventListenerService,
    ) as jest.Mocked<ContractEventListenerService>;
  });

  describe('getContractEvents', () => {
    it('should return paginated contract events', async () => {
      const mockResult = {
        data: [mockContractEvent],
        total: 10,
        page: 1,
        limit: 20,
      };

      contractEventListenerService.getContractEvents.mockResolvedValueOnce(mockResult);

      const result = await controller.getContractEvents('1', '20');

      expect(result).toEqual({
        data: [mockContractEvent],
        meta: {
          total: 10,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasMore: false,
        },
      });
      expect(contractEventListenerService.getContractEvents).toHaveBeenCalledWith(1, 20, undefined);
    });

    it('should filter by event type', async () => {
      const mockResult = {
        data: [mockContractEvent],
        total: 5,
        page: 1,
        limit: 20,
      };

      contractEventListenerService.getContractEvents.mockResolvedValueOnce(mockResult);

      const result = await controller.getContractEvents('1', '20', ContractEventType.DEPOSIT);

      expect(contractEventListenerService.getContractEvents).toHaveBeenCalledWith(
        1,
        20,
        ContractEventType.DEPOSIT,
      );
      expect(result.data).toHaveLength(1);
    });

    it('should handle pagination correctly', async () => {
      const mockResult = {
        data: [mockContractEvent],
        total: 100,
        page: 2,
        limit: 20,
      };

      contractEventListenerService.getContractEvents.mockResolvedValueOnce(mockResult);

      const result = await controller.getContractEvents('2', '20');

      expect(result.meta.totalPages).toBe(5);
      expect(result.meta.hasMore).toBe(true);
      expect(contractEventListenerService.getContractEvents).toHaveBeenCalledWith(2, 20, undefined);
    });

    it('should enforce minimum page number of 1', async () => {
      const mockResult = {
        data: [mockContractEvent],
        total: 10,
        page: 1,
        limit: 20,
      };

      contractEventListenerService.getContractEvents.mockResolvedValueOnce(mockResult);

      await controller.getContractEvents('0', '20');

      expect(contractEventListenerService.getContractEvents).toHaveBeenCalledWith(1, 20, undefined);
    });

    it('should enforce maximum limit of 100', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 100,
      };

      contractEventListenerService.getContractEvents.mockResolvedValueOnce(mockResult);

      await controller.getContractEvents('1', '200');

      expect(contractEventListenerService.getContractEvents).toHaveBeenCalledWith(1, 100, undefined);
    });

    it('should use default values for missing pagination params', async () => {
      const mockResult = {
        data: [mockContractEvent],
        total: 10,
        page: 1,
        limit: 20,
      };

      contractEventListenerService.getContractEvents.mockResolvedValueOnce(mockResult);

      await controller.getContractEvents();

      expect(contractEventListenerService.getContractEvents).toHaveBeenCalledWith(1, 20, undefined);
    });

    it('should parse invalid page as 1', async () => {
      const mockResult = {
        data: [mockContractEvent],
        total: 10,
        page: 1,
        limit: 20,
      };

      contractEventListenerService.getContractEvents.mockResolvedValueOnce(mockResult);

      await controller.getContractEvents('invalid', '20');

      expect(contractEventListenerService.getContractEvents).toHaveBeenCalledWith(1, 20, undefined);
    });
  });

  describe('getReconciliationAlerts', () => {
    it('should return paginated reconciliation alerts', async () => {
      const mockResult = {
        data: [mockReconciliationAlert],
        total: 5,
        page: 1,
        limit: 20,
      };

      contractEventListenerService.getReconciliationAlerts.mockResolvedValueOnce(mockResult);

      const result = await controller.getReconciliationAlerts('1', '20', 'true');

      expect(result).toEqual({
        data: [mockReconciliationAlert],
        meta: {
          total: 5,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasMore: false,
        },
      });
      expect(contractEventListenerService.getReconciliationAlerts).toHaveBeenCalledWith(
        1,
        20,
        true,
      );
    });

    it('should fetch unresolved alerts by default', async () => {
      const mockResult = {
        data: [mockReconciliationAlert],
        total: 3,
        page: 1,
        limit: 20,
      };

      contractEventListenerService.getReconciliationAlerts.mockResolvedValueOnce(mockResult);

      await controller.getReconciliationAlerts();

      expect(contractEventListenerService.getReconciliationAlerts).toHaveBeenCalledWith(1, 20, true);
    });

    it('should fetch all alerts when unresolved=false', async () => {
      const mockResult = {
        data: [mockReconciliationAlert],
        total: 10,
        page: 1,
        limit: 20,
      };

      contractEventListenerService.getReconciliationAlerts.mockResolvedValueOnce(mockResult);

      await controller.getReconciliationAlerts('1', '20', 'false');

      expect(contractEventListenerService.getReconciliationAlerts).toHaveBeenCalledWith(
        1,
        20,
        false,
      );
    });

    it('should handle pagination for alerts', async () => {
      const mockResult = {
        data: [mockReconciliationAlert],
        total: 50,
        page: 3,
        limit: 20,
      };

      contractEventListenerService.getReconciliationAlerts.mockResolvedValueOnce(mockResult);

      const result = await controller.getReconciliationAlerts('3', '20', 'true');

      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.hasMore).toBe(false);
    });

    it('should enforce maximum limit of 100 for alerts', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 100,
      };

      contractEventListenerService.getReconciliationAlerts.mockResolvedValueOnce(mockResult);

      await controller.getReconciliationAlerts('1', '500');

      expect(contractEventListenerService.getReconciliationAlerts).toHaveBeenCalledWith(
        1,
        100,
        true,
      );
    });
  });

  describe('resolveAlert', () => {
    it('should resolve an alert with note', async () => {
      contractEventListenerService.resolveAlert.mockResolvedValueOnce(undefined);

      const result = await controller.resolveAlert('alert-1', 'Balance manually corrected');

      expect(result).toEqual({ message: 'Alert alert-1 marked as resolved' });
      expect(contractEventListenerService.resolveAlert).toHaveBeenCalledWith(
        'alert-1',
        'Balance manually corrected',
      );
    });

    it('should resolve an alert without note', async () => {
      contractEventListenerService.resolveAlert.mockResolvedValueOnce(undefined);

      await controller.resolveAlert('alert-1');

      expect(contractEventListenerService.resolveAlert).toHaveBeenCalledWith('alert-1', '');
    });

    it('should handle resolveAlert errors gracefully', async () => {
      contractEventListenerService.resolveAlert.mockRejectedValueOnce(
        new Error('Database error'),
      );

      await expect(controller.resolveAlert('alert-1')).rejects.toThrow('Database error');
    });
  });
});
