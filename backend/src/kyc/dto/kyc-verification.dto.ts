import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsEmail,
  IsPhoneNumber,
  MaxLength,
  MinLength,
  IsNotEmpty,
  ValidateNested,
  IsArray,
  IsUUID,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  KycVerificationStatus,
  KycVerificationType,
  RiskLevel,
} from '../entities/kyc-verification.entity';
import { DocumentType } from '../entities/kyc-document.entity';

export class CreateKycVerificationDto {
  @ApiProperty({
    enum: KycVerificationType,
    description: 'Type of KYC verification',
    example: KycVerificationType.INDIVIDUAL,
  })
  @IsEnum(KycVerificationType)
  verificationType: KycVerificationType;

  @ApiPropertyOptional({
    description: 'First name',
    example: 'John',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Doe',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Date of birth',
    example: '1990-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Nationality',
    example: 'US',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1234567890',
  })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Address line 1',
    example: '123 Main St',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine1?: string;

  @ApiPropertyOptional({
    description: 'Address line 2',
    example: 'Apt 4B',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'New York',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    description: 'State or province',
    example: 'NY',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  stateProvince?: string;

  @ApiPropertyOptional({
    description: 'Postal code',
    example: '10001',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'United States',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  // Business Information
  @ApiPropertyOptional({
    description: 'Business name',
    example: 'Acme Corp',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  businessName?: string;

  @ApiPropertyOptional({
    description: 'Business registration number',
    example: '123456789',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessRegistrationNumber?: string;

  @ApiPropertyOptional({
    description: 'Business type',
    example: 'LLC',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessType?: string;

  @ApiPropertyOptional({
    description: 'Business country',
    example: 'United States',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessCountry?: string;

  @ApiPropertyOptional({
    description: 'Business address',
    example: '456 Business Ave, Suite 100, New York, NY 10001',
  })
  @IsOptional()
  @IsString()
  businessAddress?: string;
}

export class UpdateKycVerificationDto {
  @ApiPropertyOptional({
    description: 'First name',
    example: 'John',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Doe',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1234567890',
  })
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Address line 1',
    example: '123 Main St',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine1?: string;

  @ApiPropertyOptional({
    description: 'Address line 2',
    example: 'Apt 4B',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'New York',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    description: 'State or province',
    example: 'NY',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  stateProvince?: string;

  @ApiPropertyOptional({
    description: 'Postal code',
    example: '10001',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'United States',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}

export class DocumentUploadDto {
  @ApiProperty({
    enum: DocumentType,
    description: 'Type of document being uploaded',
    example: DocumentType.PASSPORT,
  })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiPropertyOptional({
    description: 'Additional metadata for the document',
    example: { notes: 'Front side of passport' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ReviewKycVerificationDto {
  @ApiProperty({
    enum: KycVerificationStatus,
    description: 'New status for the verification',
    example: KycVerificationStatus.APPROVED,
  })
  @IsEnum(KycVerificationStatus)
  status: KycVerificationStatus;

  @ApiPropertyOptional({
    description: 'Review notes',
    example: 'All documents verified successfully',
  })
  @IsOptional()
  @IsString()
  reviewNotes?: string;

  @ApiPropertyOptional({
    description: 'Rejection reason (required if status is REJECTED)',
    example: 'Document quality is too poor to verify',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({
    description: 'Rejection code',
    example: 'DOC_QUALITY_POOR',
  })
  @IsOptional()
  @IsString()
  rejectionCode?: string;

  @ApiPropertyOptional({
    enum: RiskLevel,
    description: 'Risk level assessment',
    example: RiskLevel.LOW,
  })
  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional({
    description: 'Risk score (0-100)',
    example: 25.5,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  riskScore?: number;
}

export class KycVerificationResponseDto {
  @ApiProperty({ description: 'Verification ID' })
  id: string;

  @ApiProperty({ description: 'Merchant ID' })
  merchantId: string;

  @ApiProperty({
    enum: KycVerificationStatus,
    description: 'Current verification status',
  })
  status: KycVerificationStatus;

  @ApiProperty({
    enum: KycVerificationType,
    description: 'Type of verification',
  })
  verificationType: KycVerificationType;

  @ApiPropertyOptional({
    enum: RiskLevel,
    description: 'Risk level',
  })
  riskLevel?: RiskLevel;

  @ApiPropertyOptional({
    description: 'Risk score',
  })
  riskScore?: number;

  @ApiPropertyOptional({ description: 'First name' })
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  lastName?: string;

  @ApiPropertyOptional({ description: 'Business name' })
  businessName?: string;

  @ApiPropertyOptional({ description: 'Sanctions check status' })
  sanctionsChecked?: boolean;

  @ApiPropertyOptional({ description: 'Sanctions clear status' })
  sanctionsClear?: boolean;

  @ApiPropertyOptional({ description: 'Submission timestamp' })
  submittedAt?: Date;

  @ApiPropertyOptional({ description: 'Processing timestamp' })
  processedAt?: Date;

  @ApiPropertyOptional({ description: 'Approval timestamp' })
  approvedAt?: Date;

  @ApiPropertyOptional({ description: 'Rejection timestamp' })
  rejectedAt?: Date;

  @ApiPropertyOptional({ description: 'Expiration timestamp' })
  expiresAt?: Date;

  @ApiPropertyOptional({ description: 'Next review timestamp' })
  nextReviewAt?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Review notes' })
  reviewNotes?: string;

  @ApiPropertyOptional({ description: 'Rejection reason' })
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Uploaded documents' })
  documents?: KycDocumentResponseDto[];
}

export class KycDocumentResponseDto {
  @ApiProperty({ description: 'Document ID' })
  id: string;

  @ApiProperty({
    enum: DocumentType,
    description: 'Document type',
  })
  documentType: DocumentType;

  @ApiProperty({ description: 'Document status' })
  status: string;

  @ApiProperty({ description: 'File name' })
  fileName: string;

  @ApiPropertyOptional({ description: 'Quality score' })
  qualityScore?: number;

  @ApiPropertyOptional({ description: 'Quality rating' })
  qualityRating?: string;

  @ApiPropertyOptional({ description: 'Document number' })
  documentNumber?: string;

  @ApiPropertyOptional({ description: 'Issue date' })
  issueDate?: Date;

  @ApiPropertyOptional({ description: 'Expiry date' })
  expiryDate?: Date;

  @ApiPropertyOptional({ description: 'Issuing country' })
  issuingCountry?: string;

  @ApiPropertyOptional({ description: 'Is authentic' })
  isAuthentic?: boolean;

  @ApiPropertyOptional({ description: 'Is expired' })
  isExpired?: boolean;

  @ApiProperty({ description: 'Upload timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Processing timestamp' })
  processedAt?: Date;

  @ApiPropertyOptional({ description: 'Verification timestamp' })
  verifiedAt?: Date;
}

export class KycStatusQueryDto {
  @ApiPropertyOptional({
    enum: KycVerificationStatus,
    description: 'Filter by status',
  })
  @IsOptional()
  @IsEnum(KycVerificationStatus)
  status?: KycVerificationStatus;

  @ApiPropertyOptional({
    enum: RiskLevel,
    description: 'Filter by risk level',
  })
  @IsOptional()
  @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional({
    description: 'Filter by merchant ID',
  })
  @IsOptional()
  @IsUUID()
  merchantId?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}