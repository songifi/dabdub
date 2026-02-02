import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

import { KycVerificationService } from '../kyc-verification.service';
import { KycAuditService } from '../kyc-audit.service';
import { NotificationService } from '../../../notification/notification.service';
import {
  KycVerification,
  KycVerificationStatus,
  KycVerificationType,
  RiskLevel,
} from '../../entities/kyc-verification.entity';
import { KycDocument } from '../../entities/kyc-document.entity';
import { CreateKycVerificationDto, ReviewKycVerificationDto } from '../../dto/kyc-verification.dto';

describe('KycVerificationService', () => {
  let service: KycVerificationService;
  let verificationRepository: jest.Mocked<Repository<KycVerification>>;
  let documentRepository: jest.Mocked<Repository<KycDocument>>;
  let auditService: jest.Mocked<KycAuditService>;
  let notificationService: jest.Mocked<NotificationService>;
  let kycQueue: jest.Mocked<Queue>;

  const mockVerification: Partial<KycVerification> = {
    id: 'verification-id',
    merchantId: 'merchant-id',
    status: KycVerificationStatus.DOCUMENTS_PENDING,
    verificationType: KycVerificationType.INDIVIDUAL,
    firstName: 'John',
    lastName: 'Doe',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDocument: Partial<KycDocument> = {
    id: 'document-id',
    kycVerificationId: 'verification-id',
    documentType: 'passport' as any,
    status: 'uploaded' as any,
    fileName: 'passport.jpg',
    filePath: '/path/to/passport.jpg',
    fileSize: 1024000,
    mimeType: 'image/jpeg',
    fileHash: 'hash123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockVerificationRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };

    const mockDocumentRepository = {
      find: jest.fn(),
    };

    const mockAuditService = {
      logAction: jest.fn(),
    };

    const mockNotificationService = {
      sendNotification: jest.fn(),
    };

    const mockKycQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KycVerificationService,
        {
          provide: getRepositoryToken(KycVerification),
          useValue: mockVerificationRepository,
        },
        {
          provide: getRepositoryToken(KycDocument),
          useValue: mockDocumentRepository,
        },
        {
          provide: KycAuditService,
          useValue: mockAuditService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: getQueueToken('kyc-processing'),
          useValue: mockKycQueue,
        },
      ],
    }).compile();

    service = module.get<KycVerificationService>(KycVerificationService);
    verificationRepository = module.get(getRepositoryToken(KycVerification));
    documentRepository = module.get(getRepositoryToken(KycDocument));
    auditService = module.get(KycAuditService);
    notificationService = module.get(NotificationService);
    kycQueue = module.get(getQueueToken('kyc-processing'));
  });

  describe('createVerification', () => {
    const createDto: CreateKycVerificationDto = {
      verificationType: KycVerificationType.INDIVIDUAL,
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      nationality: 'US',
      phoneNumber: '+1234567890',
      addressLine1: '123 Main St',
      city: 'New York',
      stateProvince: 'NY',
      postalCode: '10001',
      country: 'United States',
    };

    it('should create a new verification successfully', async () => {
      verificationRepository.findOne.mockResolvedValue(null);
      verificationRepository.create.mockReturnValue(mockVerification as KycVerification);
      verificationRepository.save.mockResolvedValue(mockVerification as KycVerification);
      auditService.logAction.mockResolvedValue({} as any);
      notificationService.sendNotification.mockResolvedValue({} as any);

      const result = await service.createVerification('merchant-id', createDto, 'user-id');

      expect(verificationRepository.findOne).toHaveBeenCalledWith({
        where: {
          merchantId: 'merchant-id',
          status: KycVerificationStatus.PROCESSING,
        },
      });
      expect(verificationRepository.create).toHaveBeenCalledWith({
        merchantId: 'merchant-id',
        ...createDto,
        status: KycVerificationStatus.DOCUMENTS_PENDING,
        submittedAt: expect.any(Date),
      });
      expect(verificationRepository.save).toHaveBeenCalled();
      expect(auditService.logAction).toHaveBeenCalled();
      expect(notificationService.sendNotification).toHaveBeenCalled();
      expect(result.id).toBe('verification-id');
    });

    it('should throw ConflictException if merchant already has active verification', async () => {
      verificationRepository.findOne.mockResolvedValue(mockVerification as KycVerification);

      await expect(
        service.createVerification('merchant-id', createDto, 'user-id'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getVerification', () => {
    it('should return verification successfully', async () => {
      verificationRepository.findOne.mockResolvedValue({
        ...mockVerification,
        documents: [mockDocument],
      } as any);

      const result = await service.getVerification('verification-id', 'merchant-id');

      expect(verificationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'verification-id', merchantId: 'merchant-id' },
        relations: ['documents'],
      });
      expect(result.id).toBe('verification-id');
    });

    it('should throw NotFoundException if verification not found', async () => {
      verificationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getVerification('verification-id', 'merchant-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitForReview', () => {
    it('should submit verification for review successfully', async () => {
      const verification = {
        ...mockVerification,
        status: KycVerificationStatus.DOCUMENTS_UPLOADED,
      } as KycVerification;

      verificationRepository.findOne.mockResolvedValue(verification);
      documentRepository.find.mockResolvedValue([
        { documentType: 'passport' },
        { documentType: 'proof_of_address' },
      ] as any);
      verificationRepository.save.mockResolvedValue({
        ...verification,
        status: KycVerificationStatus.PROCESSING,
      } as KycVerification);
      auditService.logAction.mockResolvedValue({} as any);
      kycQueue.add.mockResolvedValue({} as any);
      notificationService.sendNotification.mockResolvedValue({} as any);

      const result = await service.submitForReview('verification-id', 'merchant-id', 'user-id');

      expect(verificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: KycVerificationStatus.PROCESSING,
          submittedAt: expect.any(Date),
        }),
      );
      expect(kycQueue.add).toHaveBeenCalledWith('process-verification', {
        verificationId: 'verification-id',
      });
      expect(result.status).toBe(KycVerificationStatus.PROCESSING);
    });

    it('should throw BadRequestException if verification not in correct status', async () => {
      const verification = {
        ...mockVerification,
        status: KycVerificationStatus.APPROVED,
      } as KycVerification;

      verificationRepository.findOne.mockResolvedValue(verification);

      await expect(
        service.submitForReview('verification-id', 'merchant-id', 'user-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if required documents missing', async () => {
      const verification = {
        ...mockVerification,
        status: KycVerificationStatus.DOCUMENTS_UPLOADED,
      } as KycVerification;

      verificationRepository.findOne.mockResolvedValue(verification);
      documentRepository.find.mockResolvedValue([
        { documentType: 'passport' },
        // Missing proof_of_address
      ] as any);

      await expect(
        service.submitForReview('verification-id', 'merchant-id', 'user-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reviewVerification', () => {
    const reviewDto: ReviewKycVerificationDto = {
      status: KycVerificationStatus.APPROVED,
      reviewNotes: 'All documents verified',
      riskLevel: RiskLevel.LOW,
      riskScore: 25,
    };

    it('should approve verification successfully', async () => {
      const verification = {
        ...mockVerification,
        status: KycVerificationStatus.UNDER_REVIEW,
      } as KycVerification;

      verificationRepository.findOne.mockResolvedValue(verification);
      verificationRepository.save.mockResolvedValue({
        ...verification,
        status: KycVerificationStatus.APPROVED,
        approvedAt: expect.any(Date),
      } as KycVerification);
      auditService.logAction.mockResolvedValue({} as any);
      notificationService.sendNotification.mockResolvedValue({} as any);

      const result = await service.reviewVerification('verification-id', reviewDto, 'reviewer-id');

      expect(verificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: KycVerificationStatus.APPROVED,
          reviewerId: 'reviewer-id',
          reviewNotes: 'All documents verified',
          riskLevel: RiskLevel.LOW,
          riskScore: 25,
          approvedAt: expect.any(Date),
          expiresAt: expect.any(Date),
          nextReviewAt: expect.any(Date),
        }),
      );
      expect(result.status).toBe(KycVerificationStatus.APPROVED);
    });

    it('should reject verification successfully', async () => {
      const rejectDto: ReviewKycVerificationDto = {
        status: KycVerificationStatus.REJECTED,
        rejectionReason: 'Document quality too poor',
        rejectionCode: 'DOC_QUALITY_POOR',
        riskLevel: RiskLevel.HIGH,
        riskScore: 80,
      };

      const verification = {
        ...mockVerification,
        status: KycVerificationStatus.UNDER_REVIEW,
      } as KycVerification;

      verificationRepository.findOne.mockResolvedValue(verification);
      verificationRepository.save.mockResolvedValue({
        ...verification,
        status: KycVerificationStatus.REJECTED,
        rejectedAt: expect.any(Date),
      } as KycVerification);
      auditService.logAction.mockResolvedValue({} as any);
      notificationService.sendNotification.mockResolvedValue({} as any);

      const result = await service.reviewVerification('verification-id', rejectDto, 'reviewer-id');

      expect(verificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: KycVerificationStatus.REJECTED,
          rejectionReason: 'Document quality too poor',
          rejectionCode: 'DOC_QUALITY_POOR',
          rejectedAt: expect.any(Date),
        }),
      );
      expect(result.status).toBe(KycVerificationStatus.REJECTED);
    });

    it('should throw BadRequestException if verification not in reviewable status', async () => {
      const verification = {
        ...mockVerification,
        status: KycVerificationStatus.APPROVED,
      } as KycVerification;

      verificationRepository.findOne.mockResolvedValue(verification);

      await expect(
        service.reviewVerification('verification-id', reviewDto, 'reviewer-id'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkExpiredVerifications', () => {
    it('should mark expired verifications', async () => {
      const expiredVerifications = [
        {
          ...mockVerification,
          status: KycVerificationStatus.APPROVED,
          expiresAt: new Date(Date.now() - 86400000), // Yesterday
        },
      ] as KycVerification[];

      verificationRepository.find.mockResolvedValue(expiredVerifications);
      verificationRepository.save.mockResolvedValue({} as any);
      auditService.logAction.mockResolvedValue({} as any);
      notificationService.sendNotification.mockResolvedValue({} as any);

      await service.checkExpiredVerifications();

      expect(verificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: KycVerificationStatus.EXPIRED,
        }),
      );
      expect(auditService.logAction).toHaveBeenCalled();
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });
  });
});