import { Test, TestingModule } from '@nestjs/testing';
import { PrivacyService } from './privacy.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataDeletionRequest } from '../entities/data-deletion-request.entity';
import { DeletionRequestStatus } from '../enums/deletion-request-status.enum';
import { BadRequestException } from '@nestjs/common';

describe('PrivacyService', () => {
  let service: PrivacyService;
  let repository: Repository<DataDeletionRequest>;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrivacyService,
        {
          provide: getRepositoryToken(DataDeletionRequest),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PrivacyService>(PrivacyService);
    repository = module.get<Repository<DataDeletionRequest>>(
      getRepositoryToken(DataDeletionRequest),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateExecutionEligibility', () => {
    it('should throw error if status is not APPROVED', async () => {
      const request = {
        id: '123',
        status: DeletionRequestStatus.UNDER_REVIEW,
        legalHoldExpiresAt: null,
      };

      mockRepository.findOne.mockResolvedValue(request);

      await expect(service.validateExecutionEligibility('123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if legal hold is active', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const request = {
        id: '123',
        status: DeletionRequestStatus.APPROVED,
        legalHoldExpiresAt: futureDate,
      };

      mockRepository.findOne.mockResolvedValue(request);

      await expect(service.validateExecutionEligibility('123')).rejects.toThrow(
        'Legal hold is still active',
      );
    });

    it('should pass validation for approved request with expired legal hold', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 30);

      const request = {
        id: '123',
        status: DeletionRequestStatus.APPROVED,
        legalHoldExpiresAt: pastDate,
      };

      mockRepository.findOne.mockResolvedValue(request);

      await expect(service.validateExecutionEligibility('123')).resolves.not.toThrow();
    });

    it('should pass validation for approved request without legal hold', async () => {
      const request = {
        id: '123',
        status: DeletionRequestStatus.APPROVED,
        legalHoldExpiresAt: null,
      };

      mockRepository.findOne.mockResolvedValue(request);

      await expect(service.validateExecutionEligibility('123')).resolves.not.toThrow();
    });
  });

  describe('markAsCompleted', () => {
    it('should update request with completion data', async () => {
      const deletedDataSummary = {
        merchantsAnonymized: 1,
        documentsDeleted: 5,
        webhookDeliveriesDeleted: 234,
      };

      await service.markAsCompleted('123', deletedDataSummary);

      expect(mockRepository.update).toHaveBeenCalledWith('123', {
        status: DeletionRequestStatus.COMPLETED,
        completedAt: expect.any(Date),
        deletedDataSummary,
      });
    });
  });
});
