import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  KycVerification,
  KycVerificationStatus,
  RiskLevel,
} from '../entities/kyc-verification.entity';
import { KycDocument } from '../entities/kyc-document.entity';
import { KycAuditLog, AuditAction } from '../entities/kyc-audit-log.entity';
import {
  CreateKycVerificationDto,
  UpdateKycVerificationDto,
  ReviewKycVerificationDto,
  KycVerificationResponseDto,
  KycStatusQueryDto,
} from '../dto/kyc-verification.dto';
import { KycAuditService } from './kyc-audit.service';
import { NotificationService } from '../../notification/notification.service';
import { NotificationType } from '../../notification/entities/notification.entity';

@Injectable()
export class KycVerificationService {
  private readonly logger = new Logger(KycVerificationService.name);

  constructor(
    @InjectRepository(KycVerification)
    private readonly kycVerificationRepository: Repository<KycVerification>,
    @InjectRepository(KycDocument)
    private readonly kycDocumentRepository: Repository<KycDocument>,
    private readonly auditService: KycAuditService,
    private readonly notificationService: NotificationService,
    @InjectQueue('kyc-processing') private readonly kycQueue: Queue,
  ) {}

  async createVerification(
    merchantId: string,
    dto: CreateKycVerificationDto,
    userId?: string,
  ): Promise<KycVerificationResponseDto> {
    // Check if merchant already has an active verification
    const existingVerification = await this.kycVerificationRepository.findOne({
      where: {
        merchantId,
        status: KycVerificationStatus.PROCESSING,
      },
    });

    if (existingVerification) {
      throw new ConflictException(
        'Merchant already has an active KYC verification in progress',
      );
    }

    const verification = this.kycVerificationRepository.create({
      merchantId,
      ...dto,
      status: KycVerificationStatus.DOCUMENTS_PENDING,
      submittedAt: new Date(),
    });

    const savedVerification = await this.kycVerificationRepository.save(verification);

    // Create audit log
    await this.auditService.logAction(
      savedVerification.id,
      AuditAction.VERIFICATION_CREATED,
      'KYC verification created',
      userId,
      'merchant',
      null,
      { verificationType: dto.verificationType },
    );

    // Send notification
    await this.notificationService.sendNotification(
      merchantId,
      NotificationType.EMAIL,
      '', // Will be populated from merchant email
      'KYC verification process started. Please upload your documents.',
      'KYC Verification Started',
    );

    return this.mapToResponseDto(savedVerification);
  }

  async getVerification(
    verificationId: string,
    merchantId?: string,
  ): Promise<KycVerificationResponseDto> {
    const where: FindOptionsWhere<KycVerification> = { id: verificationId };
    if (merchantId) {
      where.merchantId = merchantId;
    }

    const verification = await this.kycVerificationRepository.findOne({
      where,
      relations: ['documents'],
    });

    if (!verification) {
      throw new NotFoundException('KYC verification not found');
    }

    return this.mapToResponseDto(verification);
  }

  async updateVerification(
    verificationId: string,
    dto: UpdateKycVerificationDto,
    merchantId?: string,
    userId?: string,
  ): Promise<KycVerificationResponseDto> {
    const verification = await this.findVerificationById(verificationId, merchantId);

    // Only allow updates if verification is in certain statuses
    const allowedStatuses = [
      KycVerificationStatus.DOCUMENTS_PENDING,
      KycVerificationStatus.DOCUMENTS_UPLOADED,
    ];

    if (!allowedStatuses.includes(verification.status)) {
      throw new BadRequestException(
        'Cannot update verification in current status',
      );
    }

    const oldValues = { ...verification };
    Object.assign(verification, dto);
    const updatedVerification = await this.kycVerificationRepository.save(verification);

    // Create audit log
    await this.auditService.logAction(
      verification.id,
      AuditAction.DATA_UPDATED,
      'KYC verification data updated',
      userId,
      merchantId ? 'merchant' : 'admin',
      oldValues,
      dto,
    );

    return this.mapToResponseDto(updatedVerification);
  }

  async submitForReview(
    verificationId: string,
    merchantId?: string,
    userId?: string,
  ): Promise<KycVerificationResponseDto> {
    const verification = await this.findVerificationById(verificationId, merchantId);

    if (verification.status !== KycVerificationStatus.DOCUMENTS_UPLOADED) {
      throw new BadRequestException(
        'Verification must have documents uploaded before submission',
      );
    }

    // Check if required documents are uploaded
    const requiredDocuments = await this.getRequiredDocuments(verification.verificationType);
    const uploadedDocuments = await this.kycDocumentRepository.find({
      where: { kycVerificationId: verificationId },
    });

    const uploadedTypes = uploadedDocuments.map(doc => doc.documentType);
    const missingDocuments = requiredDocuments.filter(
      type => !uploadedTypes.includes(type),
    );

    if (missingDocuments.length > 0) {
      throw new BadRequestException(
        `Missing required documents: ${missingDocuments.join(', ')}`,
      );
    }

    verification.status = KycVerificationStatus.PROCESSING;
    verification.submittedAt = new Date();
    const updatedVerification = await this.kycVerificationRepository.save(verification);

    // Create audit log
    await this.auditService.logAction(
      verification.id,
      AuditAction.STATUS_CHANGED,
      'Verification submitted for processing',
      userId,
      merchantId ? 'merchant' : 'admin',
      { status: KycVerificationStatus.DOCUMENTS_UPLOADED },
      { status: KycVerificationStatus.PROCESSING },
    );

    // Queue for processing
    await this.kycQueue.add('process-verification', {
      verificationId: verification.id,
    });

    // Send notification
    await this.notificationService.sendNotification(
      verification.merchantId,
      NotificationType.EMAIL,
      '',
      'Your KYC verification has been submitted and is being processed.',
      'KYC Verification Submitted',
    );

    return this.mapToResponseDto(updatedVerification);
  }

  async reviewVerification(
    verificationId: string,
    dto: ReviewKycVerificationDto,
    reviewerId: string,
  ): Promise<KycVerificationResponseDto> {
    const verification = await this.findVerificationById(verificationId);

    const allowedStatuses = [
      KycVerificationStatus.PROCESSING,
      KycVerificationStatus.UNDER_REVIEW,
    ];

    if (!allowedStatuses.includes(verification.status)) {
      throw new BadRequestException(
        'Cannot review verification in current status',
      );
    }

    const oldValues = { ...verification };
    verification.status = dto.status;
    verification.reviewerId = reviewerId;
    verification.reviewNotes = dto.reviewNotes;
    verification.rejectionReason = dto.rejectionReason;
    verification.rejectionCode = dto.rejectionCode;
    verification.riskLevel = dto.riskLevel;
    verification.riskScore = dto.riskScore;

    const now = new Date();
    if (dto.status === KycVerificationStatus.APPROVED) {
      verification.approvedAt = now;
      verification.expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
      verification.nextReviewAt = new Date(now.getTime() + 330 * 24 * 60 * 60 * 1000); // 11 months
    } else if (dto.status === KycVerificationStatus.REJECTED) {
      verification.rejectedAt = now;
    }

    verification.processedAt = now;
    const updatedVerification = await this.kycVerificationRepository.save(verification);

    // Create audit log
    const action = dto.status === KycVerificationStatus.APPROVED
      ? AuditAction.VERIFICATION_APPROVED
      : AuditAction.VERIFICATION_REJECTED;

    await this.auditService.logAction(
      verification.id,
      action,
      `Verification ${dto.status} by reviewer`,
      reviewerId,
      'admin',
      oldValues,
      dto,
    );

    // Send notification
    const notificationMessage = dto.status === KycVerificationStatus.APPROVED
      ? 'Your KYC verification has been approved!'
      : `Your KYC verification has been rejected. Reason: ${dto.rejectionReason}`;

    await this.notificationService.sendNotification(
      verification.merchantId,
      NotificationType.EMAIL,
      '',
      notificationMessage,
      'KYC Verification Update',
    );

    return this.mapToResponseDto(updatedVerification);
  }

  async getVerifications(
    query: KycStatusQueryDto,
  ): Promise<{ data: KycVerificationResponseDto[]; total: number; page: number; limit: number }> {
    const { status, riskLevel, merchantId, page = 1, limit = 20 } = query;

    const where: FindOptionsWhere<KycVerification> = {};
    if (status) where.status = status;
    if (riskLevel) where.riskLevel = riskLevel;
    if (merchantId) where.merchantId = merchantId;

    const [verifications, total] = await this.kycVerificationRepository.findAndCount({
      where,
      relations: ['documents'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: verifications.map(v => this.mapToResponseDto(v)),
      total,
      page,
      limit,
    };
  }

  async getMerchantVerification(merchantId: string): Promise<KycVerificationResponseDto | null> {
    const verification = await this.kycVerificationRepository.findOne({
      where: { merchantId },
      relations: ['documents'],
      order: { createdAt: 'DESC' },
    });

    return verification ? this.mapToResponseDto(verification) : null;
  }

  async checkExpiredVerifications(): Promise<void> {
    const expiredVerifications = await this.kycVerificationRepository.find({
      where: {
        status: KycVerificationStatus.APPROVED,
        expiresAt: new Date(),
      },
    });

    for (const verification of expiredVerifications) {
      verification.status = KycVerificationStatus.EXPIRED;
      await this.kycVerificationRepository.save(verification);

      await this.auditService.logAction(
        verification.id,
        AuditAction.VERIFICATION_EXPIRED,
        'Verification expired automatically',
        null,
        'system',
      );

      // Send notification
      await this.notificationService.sendNotification(
        verification.merchantId,
        NotificationType.EMAIL,
        '',
        'Your KYC verification has expired. Please submit new documents.',
        'KYC Verification Expired',
      );
    }

    this.logger.log(`Processed ${expiredVerifications.length} expired verifications`);
  }

  private async findVerificationById(
    verificationId: string,
    merchantId?: string,
  ): Promise<KycVerification> {
    const where: FindOptionsWhere<KycVerification> = { id: verificationId };
    if (merchantId) {
      where.merchantId = merchantId;
    }

    const verification = await this.kycVerificationRepository.findOne({ where });

    if (!verification) {
      throw new NotFoundException('KYC verification not found');
    }

    return verification;
  }

  private async getRequiredDocuments(verificationType: string): Promise<string[]> {
    // Define required documents based on verification type
    const requirements = {
      individual: ['passport', 'proof_of_address'],
      business: ['business_registration', 'articles_of_incorporation', 'proof_of_address'],
      enhanced: ['passport', 'proof_of_address', 'business_registration', 'bank_statement'],
    };

    return requirements[verificationType] || [];
  }

  private mapToResponseDto(verification: KycVerification): KycVerificationResponseDto {
    return {
      id: verification.id,
      merchantId: verification.merchantId,
      status: verification.status,
      verificationType: verification.verificationType,
      riskLevel: verification.riskLevel,
      riskScore: verification.riskScore,
      firstName: verification.firstName,
      lastName: verification.lastName,
      businessName: verification.businessName,
      sanctionsChecked: verification.sanctionsChecked,
      sanctionsClear: verification.sanctionsClear,
      submittedAt: verification.submittedAt,
      processedAt: verification.processedAt,
      approvedAt: verification.approvedAt,
      rejectedAt: verification.rejectedAt,
      expiresAt: verification.expiresAt,
      nextReviewAt: verification.nextReviewAt,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
      reviewNotes: verification.reviewNotes,
      rejectionReason: verification.rejectionReason,
      documents: verification.documents?.map(doc => ({
        id: doc.id,
        documentType: doc.documentType,
        status: doc.status,
        fileName: doc.fileName,
        qualityScore: doc.qualityScore,
        qualityRating: doc.qualityRating,
        documentNumber: doc.documentNumber,
        issueDate: doc.issueDate,
        expiryDate: doc.expiryDate,
        issuingCountry: doc.issuingCountry,
        isAuthentic: doc.isAuthentic,
        isExpired: doc.isExpired,
        createdAt: doc.createdAt,
        processedAt: doc.processedAt,
        verifiedAt: doc.verifiedAt,
      })),
    };
  }
}