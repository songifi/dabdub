import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as crypto from 'crypto';
import * as path from 'path';
import {
  KycDocument,
  DocumentType,
  DocumentStatus,
  DocumentQuality,
} from '../entities/kyc-document.entity';
import { KycVerification, KycVerificationStatus } from '../entities/kyc-verification.entity';
import { DocumentUploadDto, KycDocumentResponseDto } from '../dto/kyc-verification.dto';
import { KycAuditService } from './kyc-audit.service';
import { AuditAction } from '../entities/kyc-audit-log.entity';
import { StorageService } from './storage.service';

export interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class KycDocumentService {
  private readonly logger = new Logger(KycDocumentService.name);
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  constructor(
    @InjectRepository(KycDocument)
    private readonly documentRepository: Repository<KycDocument>,
    @InjectRepository(KycVerification)
    private readonly verificationRepository: Repository<KycVerification>,
    private readonly auditService: KycAuditService,
    private readonly storageService: StorageService,
    @InjectQueue('document-processing') private readonly documentQueue: Queue,
  ) {}

  async uploadDocument(
    verificationId: string,
    file: UploadedFile,
    dto: DocumentUploadDto,
    merchantId?: string,
    userId?: string,
  ): Promise<KycDocumentResponseDto> {
    // Validate file
    this.validateFile(file);

    // Get verification
    const verification = await this.getVerification(verificationId, merchantId);

    // Check if verification allows document uploads
    const allowedStatuses = [
      KycVerificationStatus.DOCUMENTS_PENDING,
      KycVerificationStatus.DOCUMENTS_UPLOADED,
    ];

    if (!allowedStatuses.includes(verification.status)) {
      throw new BadRequestException(
        'Cannot upload documents for verification in current status',
      );
    }

    // Check if document type already exists
    const existingDocument = await this.documentRepository.findOne({
      where: {
        kycVerificationId: verificationId,
        documentType: dto.documentType,
      },
    });

    if (existingDocument) {
      throw new BadRequestException(
        `Document of type ${dto.documentType} already exists`,
      );
    }

    // Generate file hash
    const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // Generate unique file path
    const fileExtension = path.extname(file.originalname);
    const fileName = `${verificationId}_${dto.documentType}_${Date.now()}${fileExtension}`;
    const filePath = `kyc-documents/${verification.merchantId}/${fileName}`;

    try {
      // Upload to storage
      const uploadResult = await this.storageService.uploadFile(
        filePath,
        file.buffer,
        file.mimetype,
      );

      // Create document record
      const document = this.documentRepository.create({
        kycVerificationId: verificationId,
        documentType: dto.documentType,
        fileName: file.originalname,
        filePath: uploadResult.path,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileHash,
        status: DocumentStatus.UPLOADED,
        metadata: dto.metadata,
      });

      const savedDocument = await this.documentRepository.save(document);

      // Update verification status if needed
      if (verification.status === KycVerificationStatus.DOCUMENTS_PENDING) {
        verification.status = KycVerificationStatus.DOCUMENTS_UPLOADED;
        await this.verificationRepository.save(verification);
      }

      // Create audit log
      await this.auditService.logAction(
        verificationId,
        AuditAction.DOCUMENT_UPLOADED,
        `Document uploaded: ${dto.documentType}`,
        userId,
        merchantId ? 'merchant' : 'admin',
        null,
        {
          documentId: savedDocument.id,
          documentType: dto.documentType,
          fileName: file.originalname,
          fileSize: file.size,
        },
      );

      // Queue for processing
      await this.documentQueue.add('process-document', {
        documentId: savedDocument.id,
      });

      return this.mapToResponseDto(savedDocument);
    } catch (error) {
      this.logger.error(`Failed to upload document: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to upload document');
    }
  }

  async getDocument(
    documentId: string,
    verificationId?: string,
    merchantId?: string,
  ): Promise<KycDocumentResponseDto> {
    const document = await this.findDocumentById(documentId, verificationId, merchantId);
    return this.mapToResponseDto(document);
  }

  async getDocuments(
    verificationId: string,
    merchantId?: string,
  ): Promise<KycDocumentResponseDto[]> {
    // Verify access to verification
    await this.getVerification(verificationId, merchantId);

    const documents = await this.documentRepository.find({
      where: { kycVerificationId: verificationId },
      order: { createdAt: 'ASC' },
    });

    return documents.map(doc => this.mapToResponseDto(doc));
  }

  async deleteDocument(
    documentId: string,
    verificationId?: string,
    merchantId?: string,
    userId?: string,
  ): Promise<void> {
    const document = await this.findDocumentById(documentId, verificationId, merchantId);

    // Check if document can be deleted
    const allowedStatuses = [
      DocumentStatus.UPLOADED,
      DocumentStatus.REJECTED,
    ];

    if (!allowedStatuses.includes(document.status)) {
      throw new BadRequestException(
        'Cannot delete document in current status',
      );
    }

    try {
      // Delete from storage
      await this.storageService.deleteFile(document.filePath);

      // Delete from database
      await this.documentRepository.remove(document);

      // Create audit log
      await this.auditService.logAction(
        document.kycVerificationId,
        AuditAction.DOCUMENT_UPLOADED, // Using existing action, could add DOCUMENT_DELETED
        `Document deleted: ${document.documentType}`,
        userId,
        merchantId ? 'merchant' : 'admin',
        {
          documentId: document.id,
          documentType: document.documentType,
          fileName: document.fileName,
        },
        null,
      );
    } catch (error) {
      this.logger.error(`Failed to delete document: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to delete document');
    }
  }

  async processDocument(documentId: string): Promise<void> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    try {
      document.status = DocumentStatus.PROCESSING;
      await this.documentRepository.save(document);

      // Download file for processing
      const fileBuffer = await this.storageService.downloadFile(document.filePath);

      // Validate document quality
      const qualityResult = await this.validateDocumentQuality(fileBuffer, document.mimeType);
      document.qualityScore = qualityResult.score;
      document.qualityRating = qualityResult.rating;
      document.qualityIssues = qualityResult.issues;

      if (qualityResult.rating === DocumentQuality.POOR) {
        document.status = DocumentStatus.REJECTED;
        document.rejectionReason = 'Document quality is too poor for processing';
        document.rejectionCode = 'QUALITY_POOR';
      } else {
        // Process with OCR if it's an image or PDF
        if (this.isProcessableDocument(document.mimeType)) {
          const ocrResult = await this.performOCR(fileBuffer, document.mimeType);
          document.ocrText = ocrResult.text;
          document.extractedData = ocrResult.extractedData;
          document.ocrConfidence = ocrResult.confidence;

          // Extract document-specific information
          const extractedInfo = this.extractDocumentInfo(
            document.documentType,
            ocrResult.extractedData,
          );
          
          if (extractedInfo) {
            document.documentNumber = extractedInfo.documentNumber;
            document.issueDate = extractedInfo.issueDate;
            document.expiryDate = extractedInfo.expiryDate;
            document.issuingAuthority = extractedInfo.issuingAuthority;
            document.issuingCountry = extractedInfo.issuingCountry;
            document.isExpired = extractedInfo.isExpired;
          }
        }

        document.status = DocumentStatus.PROCESSED;
        document.processedAt = new Date();
      }

      await this.documentRepository.save(document);

      // Create audit log
      await this.auditService.logAction(
        document.kycVerificationId,
        AuditAction.DOCUMENT_PROCESSED,
        `Document processed: ${document.documentType}`,
        null,
        'system',
        null,
        {
          documentId: document.id,
          status: document.status,
          qualityScore: document.qualityScore,
          ocrConfidence: document.ocrConfidence,
        },
      );

      // Queue for verification if processed successfully
      if (document.status === DocumentStatus.PROCESSED) {
        await this.documentQueue.add('verify-document', {
          documentId: document.id,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to process document ${documentId}: ${error.message}`, error.stack);
      
      document.status = DocumentStatus.REJECTED;
      document.rejectionReason = 'Failed to process document';
      document.rejectionCode = 'PROCESSING_ERROR';
      await this.documentRepository.save(document);
    }
  }

  private validateFile(file: UploadedFile): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`,
      );
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`,
      );
    }
  }

  private async getVerification(
    verificationId: string,
    merchantId?: string,
  ): Promise<KycVerification> {
    const where: any = { id: verificationId };
    if (merchantId) {
      where.merchantId = merchantId;
    }

    const verification = await this.verificationRepository.findOne({ where });

    if (!verification) {
      throw new NotFoundException('KYC verification not found');
    }

    return verification;
  }

  private async findDocumentById(
    documentId: string,
    verificationId?: string,
    merchantId?: string,
  ): Promise<KycDocument> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
      relations: ['kycVerification'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Check access permissions
    if (verificationId && document.kycVerificationId !== verificationId) {
      throw new NotFoundException('Document not found');
    }

    if (merchantId && document.kycVerification.merchantId !== merchantId) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  private async validateDocumentQuality(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<{
    score: number;
    rating: DocumentQuality;
    issues: string[];
  }> {
    // Placeholder for document quality validation
    // In a real implementation, this would use image processing libraries
    // to check for blur, lighting, resolution, etc.
    
    const issues: string[] = [];
    let score = 100;

    // Basic file size check
    if (fileBuffer.length < 50000) { // Less than 50KB
      issues.push('File size too small, may indicate poor quality');
      score -= 30;
    }

    // Determine rating based on score
    let rating: DocumentQuality;
    if (score >= 90) rating = DocumentQuality.EXCELLENT;
    else if (score >= 70) rating = DocumentQuality.GOOD;
    else if (score >= 50) rating = DocumentQuality.FAIR;
    else rating = DocumentQuality.POOR;

    return { score, rating, issues };
  }

  private isProcessableDocument(mimeType: string): boolean {
    return ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mimeType);
  }

  private async performOCR(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<{
    text: string;
    extractedData: Record<string, any>;
    confidence: number;
  }> {
    // Placeholder for OCR implementation
    // In a real implementation, this would integrate with:
    // - Tesseract.js for basic OCR
    // - AWS Textract for advanced document analysis
    // - Google Vision API for text detection
    
    return {
      text: 'Extracted text would appear here',
      extractedData: {
        // Structured data extracted from the document
      },
      confidence: 85.5,
    };
  }

  private extractDocumentInfo(
    documentType: DocumentType,
    extractedData: Record<string, any>,
  ): any {
    // Placeholder for document-specific information extraction
    // This would parse the OCR results based on document type
    // and extract relevant fields like document number, dates, etc.
    
    return {
      documentNumber: 'ABC123456',
      issueDate: new Date('2020-01-01'),
      expiryDate: new Date('2030-01-01'),
      issuingAuthority: 'Government Authority',
      issuingCountry: 'United States',
      isExpired: false,
    };
  }

  private mapToResponseDto(document: KycDocument): KycDocumentResponseDto {
    return {
      id: document.id,
      documentType: document.documentType,
      status: document.status,
      fileName: document.fileName,
      qualityScore: document.qualityScore,
      qualityRating: document.qualityRating,
      documentNumber: document.documentNumber,
      issueDate: document.issueDate,
      expiryDate: document.expiryDate,
      issuingCountry: document.issuingCountry,
      isAuthentic: document.isAuthentic,
      isExpired: document.isExpired,
      createdAt: document.createdAt,
      processedAt: document.processedAt,
      verifiedAt: document.verifiedAt,
    };
  }
}