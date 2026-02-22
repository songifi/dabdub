import { Test, TestingModule } from '@nestjs/testing';
import { DataRetentionService } from './data-retention.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataRetentionPolicy } from '../entities/data-retention-policy.entity';

describe('DataRetentionService', () => {
  let service: DataRetentionService;
  let repository: Repository<DataRetentionPolicy>;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataRetentionService,
        {
          provide: getRepositoryToken(DataRetentionPolicy),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DataRetentionService>(DataRetentionService);
    repository = module.get<Repository<DataRetentionPolicy>>(
      getRepositoryToken(DataRetentionPolicy),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllPolicies', () => {
    it('should return all policies ordered by dataType', async () => {
      const policies = [
        { dataType: 'audit_logs', retentionDays: 2555 },
        { dataType: 'webhook_deliveries', retentionDays: 90 },
      ];

      mockRepository.find.mockResolvedValue(policies);

      const result = await service.getAllPolicies();

      expect(result).toEqual(policies);
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { dataType: 'ASC' },
      });
    });
  });

  describe('updatePolicy', () => {
    it('should create new policy if not exists', async () => {
      const dto = {
        retentionDays: 365,
        isEnabled: true,
        legalBasis: 'Legal requirement for data retention',
        archiveBeforeDelete: true,
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue({ dataType: 'new_type', ...dto });
      mockRepository.save.mockResolvedValue({ id: '123', dataType: 'new_type', ...dto });

      const result = await service.updatePolicy('new_type', dto);

      expect(result.dataType).toBe('new_type');
      expect(result.retentionDays).toBe(365);
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should update existing policy', async () => {
      const existingPolicy = {
        id: '123',
        dataType: 'audit_logs',
        retentionDays: 2555,
        isEnabled: true,
        legalBasis: 'Old basis',
        archiveBeforeDelete: false,
      };

      const dto = {
        retentionDays: 1825,
        isEnabled: true,
        legalBasis: 'Updated legal basis',
        archiveBeforeDelete: true,
      };

      mockRepository.findOne.mockResolvedValue(existingPolicy);
      mockRepository.save.mockResolvedValue({ ...existingPolicy, ...dto });

      const result = await service.updatePolicy('audit_logs', dto);

      expect(result.retentionDays).toBe(1825);
      expect(result.legalBasis).toBe('Updated legal basis');
    });
  });

  describe('updatePurgeStats', () => {
    it('should update purge statistics', async () => {
      await service.updatePurgeStats('webhook_deliveries', 1234);

      expect(mockRepository.update).toHaveBeenCalledWith(
        { dataType: 'webhook_deliveries' },
        expect.objectContaining({
          lastPurgeDeletedCount: 1234,
        }),
      );
    });
  });
});
