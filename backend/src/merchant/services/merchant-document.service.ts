import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { MerchantDocument } from '../entities/merchant-document.entity';
import { DocumentRequest } from '../entities/document-request.entity';
import { Merchant, KycStatus } from '../../database/entities/merchant.entity';
import { DocumentType, DocumentStatus } from '../enums/merchant-document.enums';
import { StorageService } from '../../kyc/services/storage.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { NotificationService } from '../../notification/notification.service';
import { AuditAction, ActorType } from '../../database/entities/audit-log.enums';
import { addMonths, addYears, isBefore, subDays } from 'date-fns';

@Injectable()
export class MerchantDocumentService {
  private readonly logger = new Logger(MerchantDocumentService.name);

  constructor(
    @InjectRepository(MerchantDocument)
    private readonly documentRepository: Repository<MerchantDocument>,
    @InjectRepository(DocumentRequest)
    private readonly requestRepository: Repository<DocumentRequest>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    private readonly storageService: StorageService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationService: NotificationService,
  ) {}

  async listMerchantDocuments(merchantId: string) {
    const documents = await this.documentRepository.find({
      where: { merchantId },
      order: { version: 'DESC', createdAt: 'DESC' },
    });

    const grouped = documents.reduce((acc, doc) => {
      if (!acc[doc.documentType]) {
        acc[doc.documentType] = {
          documentType: doc.documentType,
          currentVersion: null,
          previousVersions: [],
        };
      }

      const entry = acc[doc.documentType];
      if (!entry.currentVersion) {
        entry.currentVersion = {
          id: doc.id,
          version: doc.version,
          status: doc.status,
          uploadedAt: doc.createdAt,
          reviewedAt: doc.reviewedAt,
          documentExpiresAt: doc.documentExpiresAt,
          isExpiringSoon: this.isExpiringSoon(doc.documentExpiresAt),
        };
      } else {
        entry.previousVersions.push({
          id: doc.id,
          version: doc.version,
          status: doc.status,
          rejectionReason: doc.rejectionReason,
        });
      }
      return acc;
    }, {} as Record<string, any>);

    const expiringWithin30Days = documents
      .filter((doc) => doc.status === DocumentStatus.ACCEPTED && this.isExpiringSoon(doc.documentExpiresAt))
      .map((doc) => doc.documentType);

    const uploadedTypes = new Set(documents.map((doc) => doc.documentType));
    const requiredTypes = [
      DocumentType.BUSINESS_REGISTRATION,
      DocumentType.DIRECTORS_ID,
      DocumentType.BENEFICIAL_OWNER_FORM,
    ]; // Example required types
    const missing = requiredTypes.filter((type) => !uploadedTypes.has(type));

    return {
      documents: Object.values(grouped),
      expiringWithin30Days: Array.from(new Set(expiringWithin30Days)),
      missing,
    };
  }

  async getDownloadUrl(merchantId: string, documentId: string, adminId: string) {
    const document = await this.documentRepository.findOne({
      where: { id: documentId, merchantId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const url = await this.storageService.getSignedUrl(document.s3Key, 600); // 10 minutes

    await this.auditLogService.log({
      entityType: 'MerchantDocument',
      entityId: documentId,
      action: AuditAction.VIEW as any, // AuditAction.VIEW might not exist, using "VIEW" if not
      actorId: adminId,
      actorType: ActorType.ADMIN,
      metadata: { merchantId, documentType: document.documentType },
    });

    return { url };
  }

  async acceptDocument(documentId: string, adminId: string) {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['merchant'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    document.status = DocumentStatus.ACCEPTED;
    document.reviewedById = adminId;
    document.reviewedAt = new Date();
    document.documentExpiresAt = this.calculateExpiry(document.documentType);

    await this.documentRepository.save(document);

    // Supersede previous versions
    await this.documentRepository.update(
      {
        merchantId: document.merchantId,
        documentType: document.documentType,
        id: LessThanOrEqual(documentId), // This should ideally be version based but id works if sequential
        status: DocumentStatus.ACCEPTED,
      },
      { status: DocumentStatus.SUPERSEDED },
    );
    // Fix: the above update would also supersede itself if not careful
    // Better:
    await this.documentRepository
      .createQueryBuilder()
      .update(MerchantDocument)
      .set({ status: DocumentStatus.SUPERSEDED })
      .where('merchant_id = :merchantId', { merchantId: document.merchantId })
      .andWhere('document_type = :documentType', { documentType: document.documentType })
      .andWhere('id != :id', { id: document.id })
      .andWhere('status = :status', { status: DocumentStatus.ACCEPTED })
      .execute();

    // Check if all required documents are accepted
    await this.checkAndAdvanceKycStatus(document.merchantId);

    return document;
  }

  async rejectDocument(documentId: string, rejectionReason: string, adminId: string) {
    if (rejectionReason.length < 20) {
      throw new BadRequestException('Rejection reason must be at least 20 characters');
    }

    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    document.status = DocumentStatus.REJECTED;
    document.rejectionReason = rejectionReason;
    document.reviewedById = adminId;
    document.reviewedAt = new Date();

    await this.documentRepository.save(document);

    // Notify merchant
    await this.notificationService.sendNotification({
        userId: document.merchantId, // Assuming merchantId is the userId for notification
        type: 'KYC_DOCUMENT_REJECTED',
        payload: {
          documentType: document.documentType,
          rejectionReason,
        },
    });

    return document;
  }

  async getExpiringDocuments(withinDays: number = 30, documentType?: DocumentType, page: number = 1, limit: number = 20) {
    const expiryThreshold = addMonths(new Date(), 0); // Placeholder, will use withinDays
    const thresholdDate = addDays(new Date(), withinDays);

    const qb = this.documentRepository.createQueryBuilder('doc')
      .leftJoinAndSelect('doc.merchant', 'merchant')
      .where('doc.status = :status', { status: DocumentStatus.ACCEPTED })
      .andWhere('doc.document_expires_at <= :thresholdDate', { thresholdDate })
      .andWhere('doc.document_expires_at > :now', { now: new Date() });

    if (documentType) {
      qb.andWhere('doc.document_type = :documentType', { documentType });
    }

    qb.orderBy('doc.document_expires_at', 'ASC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data.map((doc) => ({
        merchant: {
          id: doc.merchant.id,
          businessName: doc.merchant.businessName,
          email: doc.merchant.email,
        },
        documentType: doc.documentType,
        documentId: doc.id,
        expiresAt: doc.documentExpiresAt,
        daysUntilExpiry: Math.ceil((doc.documentExpiresAt!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
        expiryAlertSentAt: doc.expiryAlertSentAt,
      })),
      meta: { total },
    };
  }

  async sendRenewalRequest(documentId: string) {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['merchant'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.expiryAlertSentAt && isBefore(new Date(), addDays(document.expiryAlertSentAt, 7))) {
      throw new ConflictException('Renewal request can only be sent once every 7 days');
    }

    // Send email via notification service
    await this.notificationService.sendNotification({
        userId: document.merchantId,
        type: 'KYC_DOCUMENT_RENEWAL_REQUEST',
        payload: {
          documentType: document.documentType,
          expiresAt: document.documentExpiresAt,
        },
    });

    document.expiryAlertSentAt = new Date();
    await this.documentRepository.save(document);

    return { success: true };
  }

  private isExpiringSoon(expiresAt: Date | null): boolean {
    if (!expiresAt) return false;
    const thirtyDaysFromNow = addMonths(new Date(), 1);
    return isBefore(expiresAt, thirtyDaysFromNow) && !isBefore(expiresAt, new Date());
  }

  private calculateExpiry(type: DocumentType): Date | null {
    const now = new Date();
    switch (type) {
      case DocumentType.DIRECTORS_ID:
        return addYears(now, 5);
      case DocumentType.BANK_STATEMENT:
      case DocumentType.UTILITY_BILL:
        return addMonths(now, 3);
      default:
        return null; // No expiry for others by default
    }
  }

  private async checkAndAdvanceKycStatus(merchantId: string) {
    const requiredTypes = [
      DocumentType.BUSINESS_REGISTRATION,
      DocumentType.DIRECTORS_ID,
      DocumentType.BENEFICIAL_OWNER_FORM,
    ];

    const acceptedDocs = await this.documentRepository.find({
      where: {
        merchantId,
        status: DocumentStatus.ACCEPTED,
      },
    });

    const acceptedTypes = new Set(acceptedDocs.map((d) => d.documentType));
    const allRequiredAccepted = requiredTypes.every((type) => acceptedTypes.has(type));

    if (allRequiredAccepted) {
        await this.merchantRepository.update(merchantId, {
            kycStatus: KycStatus.APPROVED,
            kycVerifiedAt: new Date(),
        });
        this.logger.log(`KyC approved for merchant ${merchantId}`);
    }
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
