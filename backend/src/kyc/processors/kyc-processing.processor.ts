import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  KycVerification,
  KycVerificationStatus,
} from '../entities/kyc-verification.entity';
import { KycDocument } from '../entities/kyc-document.entity';
import { KycAuditService } from '../services/kyc-audit.service';
import { VerificationProviderService } from '../services/verification-provider.service';
import { RiskAssessmentService } from '../services/risk-assessment.service';
import { NotificationService } from '../../notification/notification.service';
import { NotificationType } from '../../notification/entities/notification.entity';
import { AuditAction } from '../entities/kyc-audit-log.entity';

@Processor('kyc-processing')
export class KycProcessingProcessor {
  private readonly logger = new Logger(KycProcessingProcessor.name);

  constructor(
    @InjectRepository(KycVerification)
    private readonly verificationRepository: Repository<KycVerification>,
    @InjectRepository(KycDocument)
    private readonly documentRepository: Repository<KycDocument>,
    private readonly auditService: KycAuditService,
    private readonly verificationProvider: VerificationProviderService,
    private readonly riskAssessment: RiskAssessmentService,
    private readonly notificationService: NotificationService,
  ) {}

  @Process('process-verification')
  async processVerification(job: Job<{ verificationId: string }>): Promise<void> {
    const { verificationId } = job.data;
    
    try {
      this.logger.log(`Starting verification processing for ${verificationId}`);

      const verification = await this.verificationRepository.findOne({
        where: { id: verificationId },
      });

      if (!verification) {
        throw new Error(`Verification ${verificationId} not found`);
      }

      // Get all documents for this verification
      const documents = await this.documentRepository.find({
        where: { kycVerificationId: verificationId },
      });

      // Step 1: Identity Verification
      let identityResult;
      if (verification.verificationType === 'individual' || verification.verificationType === 'enhanced') {
        identityResult = await this.performIdentityVerification(verification, documents);
        
        await this.auditService.logAction(
          verificationId,
          AuditAction.IDENTITY_VERIFIED,
          'Identity verification completed',
          null,
          'system',
          null,
          { result: identityResult },
        );
      }

      // Step 2: Business Verification (if applicable)
      let businessResult;
      if (verification.verificationType === 'business' || verification.verificationType === 'enhanced') {
        businessResult = await this.performBusinessVerification(verification, documents);
        
        await this.auditService.logAction(
          verificationId,
          AuditAction.BUSINESS_VERIFIED,
          'Business verification completed',
          null,
          'system',
          null,
          { result: businessResult },
        );
      }

      // Step 3: Sanctions Screening
      const sanctionsResult = await this.performSanctionsCheck(verification);
      
      verification.sanctionsChecked = true;
      verification.sanctionsClear = sanctionsResult.success;
      verification.sanctionsDetails = sanctionsResult.details;

      await this.auditService.logAction(
        verificationId,
        AuditAction.SANCTIONS_CHECKED,
        'Sanctions screening completed',
        null,
        'system',
        null,
        { result: sanctionsResult },
      );

      // Step 4: Risk Assessment
      const riskResult = await this.riskAssessment.assessRisk(
        verification,
        documents,
        sanctionsResult,
        businessResult,
      );

      verification.riskLevel = riskResult.riskLevel;
      verification.riskScore = riskResult.riskScore;

      await this.auditService.logAction(
        verificationId,
        AuditAction.RISK_ASSESSED,
        'Risk assessment completed',
        null,
        'system',
        null,
        { result: riskResult },
      );

      // Step 5: Determine next status
      if (!sanctionsResult.success) {
        // Sanctions match - immediate rejection
        verification.status = KycVerificationStatus.REJECTED;
        verification.rejectionReason = 'Sanctions screening failed';
        verification.rejectionCode = 'SANCTIONS_MATCH';
        verification.rejectedAt = new Date();
      } else if (riskResult.requiresManualReview) {
        // Requires manual review
        verification.status = KycVerificationStatus.UNDER_REVIEW;
      } else if (riskResult.riskLevel === 'low') {
        // Auto-approve low risk
        verification.status = KycVerificationStatus.APPROVED;
        verification.approvedAt = new Date();
        const now = new Date();
        verification.expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year
        verification.nextReviewAt = new Date(now.getTime() + 330 * 24 * 60 * 60 * 1000); // 11 months
      } else {
        // Medium risk - manual review
        verification.status = KycVerificationStatus.UNDER_REVIEW;
      }

      verification.processedAt = new Date();
      verification.providerResponse = {
        identity: identityResult,
        business: businessResult,
        sanctions: sanctionsResult,
        risk: riskResult,
      };

      await this.verificationRepository.save(verification);

      // Send notification
      await this.sendStatusNotification(verification);

      // Create final audit log
      await this.auditService.logAction(
        verificationId,
        AuditAction.STATUS_CHANGED,
        `Verification processing completed with status: ${verification.status}`,
        null,
        'system',
        null,
        { 
          status: verification.status,
          riskLevel: verification.riskLevel,
          riskScore: verification.riskScore,
        },
      );

      this.logger.log(`Verification processing completed for ${verificationId}: ${verification.status}`);

    } catch (error) {
      this.logger.error(`Verification processing failed for ${verificationId}: ${error.message}`, error.stack);
      
      // Update verification status to failed
      try {
        await this.verificationRepository.update(verificationId, {
          status: KycVerificationStatus.REJECTED,
          rejectionReason: 'Processing failed due to system error',
          rejectionCode: 'PROCESSING_ERROR',
          rejectedAt: new Date(),
        });

        await this.auditService.logAction(
          verificationId,
          AuditAction.VERIFICATION_REJECTED,
          'Verification failed due to processing error',
          null,
          'system',
          null,
          { error: error.message },
        );
      } catch (updateError) {
        this.logger.error(`Failed to update verification status: ${updateError.message}`);
      }

      throw error;
    }
  }

  private async performIdentityVerification(
    verification: KycVerification,
    documents: KycDocument[],
  ): Promise<any> {
    try {
      // Find identity document
      const identityDoc = documents.find(doc => 
        ['passport', 'drivers_license', 'national_id'].includes(doc.documentType),
      );

      if (!identityDoc) {
        throw new Error('No identity document found');
      }

      // Find selfie document (if required)
      const selfieDoc = documents.find(doc => doc.documentType === 'selfie');

      const request = {
        firstName: verification.firstName,
        lastName: verification.lastName,
        dateOfBirth: verification.dateOfBirth?.toISOString().split('T')[0],
        nationality: verification.nationality,
        documentType: identityDoc.documentType,
        documentNumber: identityDoc.documentNumber,
        documentImageUrl: identityDoc.filePath,
        selfieImageUrl: selfieDoc?.filePath,
      };

      return await this.verificationProvider.verifyIdentity(request);
    } catch (error) {
      this.logger.error(`Identity verification failed: ${error.message}`);
      return {
        success: false,
        status: 'error',
        confidence: 0,
        details: {},
        providerReference: '',
        errors: [error.message],
      };
    }
  }

  private async performBusinessVerification(
    verification: KycVerification,
    documents: KycDocument[],
  ): Promise<any> {
    try {
      // Find business registration document
      const businessDoc = documents.find(doc => 
        ['business_registration', 'articles_of_incorporation', 'certificate_of_incorporation'].includes(doc.documentType),
      );

      if (!businessDoc) {
        throw new Error('No business registration document found');
      }

      const request = {
        businessName: verification.businessName,
        registrationNumber: verification.businessRegistrationNumber,
        businessType: verification.businessType,
        country: verification.businessCountry,
        address: verification.businessAddress,
        documentImageUrl: businessDoc.filePath,
      };

      return await this.verificationProvider.verifyBusiness(request);
    } catch (error) {
      this.logger.error(`Business verification failed: ${error.message}`);
      return {
        success: false,
        status: 'error',
        confidence: 0,
        details: {},
        providerReference: '',
        errors: [error.message],
      };
    }
  }

  private async performSanctionsCheck(verification: KycVerification): Promise<any> {
    try {
      return await this.verificationProvider.checkSanctions(
        verification.firstName,
        verification.lastName,
        verification.dateOfBirth?.toISOString().split('T')[0],
        verification.nationality,
      );
    } catch (error) {
      this.logger.error(`Sanctions check failed: ${error.message}`);
      return {
        success: false,
        status: 'error',
        confidence: 0,
        details: {},
        providerReference: '',
        errors: [error.message],
      };
    }
  }

  private async sendStatusNotification(verification: KycVerification): Promise<void> {
    try {
      let message: string;
      let subject: string;

      switch (verification.status) {
        case KycVerificationStatus.APPROVED:
          subject = 'KYC Verification Approved';
          message = 'Congratulations! Your KYC verification has been approved. You can now access all platform features.';
          break;
        case KycVerificationStatus.REJECTED:
          subject = 'KYC Verification Rejected';
          message = `Your KYC verification has been rejected. Reason: ${verification.rejectionReason}. Please contact support for assistance.`;
          break;
        case KycVerificationStatus.UNDER_REVIEW:
          subject = 'KYC Verification Under Review';
          message = 'Your KYC verification is currently under manual review. We will notify you once the review is complete.';
          break;
        default:
          return; // No notification for other statuses
      }

      await this.notificationService.sendNotification(
        verification.merchantId,
        NotificationType.EMAIL,
        '', // Email will be fetched from merchant record
        message,
        subject,
      );
    } catch (error) {
      this.logger.error(`Failed to send status notification: ${error.message}`);
      // Don't throw error as this is not critical
    }
  }
}