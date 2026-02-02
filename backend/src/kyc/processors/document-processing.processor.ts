import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  KycDocument,
  DocumentStatus,
} from '../entities/kyc-document.entity';
import { KycDocumentService } from '../services/kyc-document.service';
import { VerificationProviderService } from '../services/verification-provider.service';
import { KycAuditService } from '../services/kyc-audit.service';
import { AuditAction } from '../entities/kyc-audit-log.entity';

@Processor('document-processing')
export class DocumentProcessingProcessor {
  private readonly logger = new Logger(DocumentProcessingProcessor.name);

  constructor(
    @InjectRepository(KycDocument)
    private readonly documentRepository: Repository<KycDocument>,
    private readonly documentService: KycDocumentService,
    private readonly verificationProvider: VerificationProviderService,
    private readonly auditService: KycAuditService,
  ) {}

  @Process('process-document')
  async processDocument(job: Job<{ documentId: string }>): Promise<void> {
    const { documentId } = job.data;
    
    try {
      this.logger.log(`Starting document processing for ${documentId}`);

      await this.documentService.processDocument(documentId);

      this.logger.log(`Document processing completed for ${documentId}`);
    } catch (error) {
      this.logger.error(`Document processing failed for ${documentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Process('verify-document')
  async verifyDocument(job: Job<{ documentId: string }>): Promise<void> {
    const { documentId } = job.data;
    
    try {
      this.logger.log(`Starting document verification for ${documentId}`);

      const document = await this.documentRepository.findOne({
        where: { id: documentId },
      });

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      if (document.status !== DocumentStatus.PROCESSED) {
        throw new Error(`Document ${documentId} is not in processed status`);
      }

      // Perform document-specific verification
      const verificationResult = await this.performDocumentVerification(document);

      // Update document with verification results
      document.verificationProvider = verificationResult.provider;
      document.verificationReference = verificationResult.reference;
      document.verificationResult = verificationResult.details;
      document.isAuthentic = verificationResult.isAuthentic;
      document.verifiedAt = new Date();

      if (verificationResult.isAuthentic) {
        document.status = DocumentStatus.VERIFIED;
      } else {
        document.status = DocumentStatus.REJECTED;
        document.rejectionReason = verificationResult.rejectionReason;
        document.rejectionCode = verificationResult.rejectionCode;
      }

      await this.documentRepository.save(document);

      // Create audit log
      await this.auditService.logAction(
        document.kycVerificationId,
        document.status === DocumentStatus.VERIFIED 
          ? AuditAction.DOCUMENT_VERIFIED 
          : AuditAction.DOCUMENT_REJECTED,
        `Document verification completed: ${document.documentType}`,
        null,
        'system',
        null,
        {
          documentId: document.id,
          status: document.status,
          isAuthentic: document.isAuthentic,
          verificationResult,
        },
      );

      this.logger.log(`Document verification completed for ${documentId}: ${document.status}`);
    } catch (error) {
      this.logger.error(`Document verification failed for ${documentId}: ${error.message}`, error.stack);
      
      // Update document status to rejected
      try {
        await this.documentRepository.update(documentId, {
          status: DocumentStatus.REJECTED,
          rejectionReason: 'Verification failed due to system error',
          rejectionCode: 'VERIFICATION_ERROR',
        });

        const document = await this.documentRepository.findOne({
          where: { id: documentId },
        });

        if (document) {
          await this.auditService.logAction(
            document.kycVerificationId,
            AuditAction.DOCUMENT_REJECTED,
            'Document verification failed due to system error',
            null,
            'system',
            null,
            { error: error.message },
          );
        }
      } catch (updateError) {
        this.logger.error(`Failed to update document status: ${updateError.message}`);
      }

      throw error;
    }
  }

  @Process('check-document-expiry')
  async checkDocumentExpiry(job: Job): Promise<void> {
    try {
      this.logger.log('Starting document expiry check');

      const expiredDocuments = await this.documentRepository
        .createQueryBuilder('document')
        .where('document.expiryDate <= :now', { now: new Date() })
        .andWhere('document.status = :status', { status: DocumentStatus.VERIFIED })
        .getMany();

      for (const document of expiredDocuments) {
        document.status = DocumentStatus.EXPIRED;
        document.isExpired = true;
        await this.documentRepository.save(document);

        await this.auditService.logAction(
          document.kycVerificationId,
          AuditAction.DOCUMENT_EXPIRED,
          `Document expired: ${document.documentType}`,
          null,
          'system',
          null,
          { documentId: document.id },
        );
      }

      this.logger.log(`Processed ${expiredDocuments.length} expired documents`);
    } catch (error) {
      this.logger.error(`Document expiry check failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async performDocumentVerification(document: KycDocument): Promise<{
    provider: string;
    reference: string;
    details: any;
    isAuthentic: boolean;
    rejectionReason?: string;
    rejectionCode?: string;
  }> {
    try {
      // This would integrate with document verification services
      // For now, we'll simulate the verification process

      // Basic checks
      if (!document.extractedData || Object.keys(document.extractedData).length === 0) {
        return {
          provider: 'internal',
          reference: `internal_${Date.now()}`,
          details: { reason: 'No extracted data available' },
          isAuthentic: false,
          rejectionReason: 'Document could not be processed',
          rejectionCode: 'NO_EXTRACTED_DATA',
        };
      }

      // Check document quality
      if (document.qualityRating === 'poor') {
        return {
          provider: 'internal',
          reference: `internal_${Date.now()}`,
          details: { reason: 'Poor document quality' },
          isAuthentic: false,
          rejectionReason: 'Document quality is too poor for verification',
          rejectionCode: 'POOR_QUALITY',
        };
      }

      // Check OCR confidence
      if (document.ocrConfidence && document.ocrConfidence < 70) {
        return {
          provider: 'internal',
          reference: `internal_${Date.now()}`,
          details: { reason: 'Low OCR confidence', confidence: document.ocrConfidence },
          isAuthentic: false,
          rejectionReason: 'Document text could not be read reliably',
          rejectionCode: 'LOW_OCR_CONFIDENCE',
        };
      }

      // Simulate external verification service call
      // In a real implementation, this would call services like:
      // - Onfido for document verification
      // - Jumio for ID verification
      // - Custom ML models for fraud detection

      const mockVerificationResult = {
        provider: 'onfido',
        reference: `onfido_${Date.now()}`,
        details: {
          documentType: document.documentType,
          extractedData: document.extractedData,
          qualityChecks: {
            imageQuality: 'good',
            documentQuality: 'good',
            visualAuthenticity: 'authentic',
          },
          dataConsistency: {
            extractedVsExpected: 'consistent',
            crossFieldValidation: 'passed',
          },
          securityFeatures: {
            hologram: 'present',
            watermark: 'present',
            microprint: 'present',
          },
        },
        isAuthentic: true,
      };

      // Add some randomness for testing
      const randomFactor = Math.random();
      if (randomFactor < 0.05) { // 5% chance of rejection for testing
        return {
          ...mockVerificationResult,
          isAuthentic: false,
          rejectionReason: 'Document failed authenticity checks',
          rejectionCode: 'AUTHENTICITY_FAILED',
        };
      }

      return mockVerificationResult;
    } catch (error) {
      this.logger.error(`Document verification service error: ${error.message}`);
      return {
        provider: 'internal',
        reference: `error_${Date.now()}`,
        details: { error: error.message },
        isAuthentic: false,
        rejectionReason: 'Verification service error',
        rejectionCode: 'SERVICE_ERROR',
      };
    }
  }
}