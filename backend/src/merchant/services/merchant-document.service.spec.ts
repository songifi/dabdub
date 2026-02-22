import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MerchantDocumentService } from './merchant-document.service';
import { MerchantDocument } from '../entities/merchant-document.entity';
import { DocumentRequest } from '../entities/document-request.entity';
import { Merchant } from '../../database/entities/merchant.entity';
import { StorageService } from '../../kyc/services/storage.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { NotificationService } from '../../notification/notification.service';
import { DocumentType, DocumentStatus } from '../enums/merchant-document.enums';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { addDays, subDays } from 'date-fns';

describe('MerchantDocumentService', () => {
  let service: MerchantDocumentService;
  let documentRepo: any;
  let merchantRepo: any;
  let storageService: any;
  let notificationService: any;

  const mockDocument = {
    id: 'doc-1',
    merchantId: 'merchant-1',
    documentType: DocumentType.DIRECTORS_ID,
    status: DocumentStatus.UPLOADED,
    s3Key: 'key/doc.pdf',
    version: 1,
    createdAt: new Date(),
    save: jest.fn(),
  };

  const mockMerchant = {
    id: 'merchant-1',
    businessName: 'Acme Corp',
    email: 'admin@acme.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantDocumentService,
        {
          provide: getRepositoryToken(MerchantDocument),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              update: jest.fn().mockReturnThis(),
              set: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              execute: jest.fn(),
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getManyAndCount: jest.fn(),
            })),
          },
        },
        {
          provide: getRepositoryToken(DocumentRequest),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: StorageService,
          useValue: {
            getSignedUrl: jest.fn(),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MerchantDocumentService>(MerchantDocumentService);
    documentRepo = module.get(getRepositoryToken(MerchantDocument));
    merchantRepo = module.get(getRepositoryToken(Merchant));
    storageService = module.get(StorageService);
    notificationService = module.get(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDownloadUrl', () => {
    it('should return a pre-signed URL', async () => {
      documentRepo.findOne.mockResolvedValue(mockDocument);
      storageService.getSignedUrl.mockResolvedValue('https://s3.signed.url');

      const result = await service.getDownloadUrl('merchant-1', 'doc-1', 'admin-1');

      expect(result.url).toBe('https://s3.signed.url');
      expect(storageService.getSignedUrl).toHaveBeenCalledWith('key/doc.pdf', 600);
    });

    it('should throw NotFoundException if document not found', async () => {
      documentRepo.findOne.mockResolvedValue(null);
      await expect(service.getDownloadUrl('m-1', 'd-1', 'a-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('acceptDocument', () => {
    it('should set status to ACCEPTED and calculate expiry', async () => {
      documentRepo.findOne.mockResolvedValue({ ...mockDocument, documentType: DocumentType.DIRECTORS_ID });
      
      const result = await service.acceptDocument('doc-1', 'admin-1');

      expect(result.status).toBe(DocumentStatus.ACCEPTED);
      expect(result.documentExpiresAt).toBeDefined();
      // For DIRECTORS_ID it should be 5 years from now
      const fiveYearsFromNow = new Date();
      fiveYearsFromNow.setFullYear(fiveYearsFromNow.getFullYear() + 5);
      expect(result.documentExpiresAt?.getFullYear()).toBe(fiveYearsFromNow.getFullYear());
    });
  });

  describe('rejectDocument', () => {
    it('should throw BadRequestException if reason is too short', async () => {
      await expect(service.rejectDocument('doc-1', 'short', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('should set status to REJECTED and notify merchant', async () => {
      documentRepo.findOne.mockResolvedValue(mockDocument);
      const reason = 'The document is blurry and unreadable. Please upload a high resolution version.';
      
      await service.rejectDocument('doc-1', reason, 'admin-1');

      expect(documentRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        status: DocumentStatus.REJECTED,
        rejectionReason: reason,
      }));
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });
  });

  describe('sendRenewalRequest', () => {
    it('should rate limit requests to 7 days', async () => {
      const docWithRecentAlert = {
        ...mockDocument,
        expiryAlertSentAt: subDays(new Date(), 3),
      };
      documentRepo.findOne.mockResolvedValue(docWithRecentAlert);

      await expect(service.sendRenewalRequest('doc-1')).rejects.toThrow(ConflictException);
    });

    it('should send alert if no previous alert or older than 7 days', async () => {
        documentRepo.findOne.mockResolvedValue(mockDocument);
        await service.sendRenewalRequest('doc-1');
        expect(notificationService.sendNotification).toHaveBeenCalled();
        expect(documentRepo.save).toHaveBeenCalled();
    });
  });
});
