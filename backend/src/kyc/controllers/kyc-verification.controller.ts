import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { MerchantAuthGuard } from '../../merchant/guards/merchant-auth.guard';
import { KycVerificationService } from '../services/kyc-verification.service';
import { KycDocumentService } from '../services/kyc-document.service';
import {
  CreateKycVerificationDto,
  UpdateKycVerificationDto,
  ReviewKycVerificationDto,
  DocumentUploadDto,
  KycVerificationResponseDto,
  KycDocumentResponseDto,
  KycStatusQueryDto,
} from '../dto/kyc-verification.dto';

@ApiTags('KYC Verification')
@Controller('api/v1/kyc')
export class KycVerificationController {
  constructor(
    private readonly kycVerificationService: KycVerificationService,
    private readonly kycDocumentService: KycDocumentService,
  ) {}

  @Post('verifications')
  @UseGuards(MerchantAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new KYC verification' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'KYC verification created successfully',
    type: KycVerificationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Merchant already has an active verification',
  })
  async createVerification(
    @Request() req: any,
    @Body() dto: CreateKycVerificationDto,
  ): Promise<KycVerificationResponseDto> {
    return this.kycVerificationService.createVerification(
      req.user.id,
      dto,
      req.user.id,
    );
  }

  @Get('verifications/me')
  @UseGuards(MerchantAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get merchant KYC verification' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'KYC verification retrieved successfully',
    type: KycVerificationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'No KYC verification found',
  })
  async getMerchantVerification(@Request() req: any): Promise<KycVerificationResponseDto | null> {
    return this.kycVerificationService.getMerchantVerification(req.user.id);
  }

  @Get('verifications/:id')
  @UseGuards(MerchantAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get KYC verification by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'KYC verification retrieved successfully',
    type: KycVerificationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'KYC verification not found',
  })
  async getVerification(
    @Request() req: any,
    @Param('id') verificationId: string,
  ): Promise<KycVerificationResponseDto> {
    return this.kycVerificationService.getVerification(verificationId, req.user.id);
  }

  @Put('verifications/:id')
  @UseGuards(MerchantAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update KYC verification' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'KYC verification updated successfully',
    type: KycVerificationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot update verification in current status',
  })
  async updateVerification(
    @Request() req: any,
    @Param('id') verificationId: string,
    @Body() dto: UpdateKycVerificationDto,
  ): Promise<KycVerificationResponseDto> {
    return this.kycVerificationService.updateVerification(
      verificationId,
      dto,
      req.user.id,
      req.user.id,
    );
  }

  @Post('verifications/:id/submit')
  @UseGuards(MerchantAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit KYC verification for review' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'KYC verification submitted successfully',
    type: KycVerificationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Missing required documents or invalid status',
  })
  async submitVerification(
    @Request() req: any,
    @Param('id') verificationId: string,
  ): Promise<KycVerificationResponseDto> {
    return this.kycVerificationService.submitForReview(
      verificationId,
      req.user.id,
      req.user.id,
    );
  }

  @Post('verifications/:id/documents')
  @UseGuards(MerchantAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload KYC document' })
  @ApiBody({
    description: 'Document upload',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file (JPEG, PNG, WebP, PDF)',
        },
        documentType: {
          type: 'string',
          enum: [
            'passport',
            'drivers_license',
            'national_id',
            'utility_bill',
            'bank_statement',
            'business_registration',
            'articles_of_incorporation',
            'memorandum_of_association',
            'certificate_of_incorporation',
            'tax_certificate',
            'proof_of_address',
            'selfie',
            'other',
          ],
          description: 'Type of document being uploaded',
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the document',
        },
      },
      required: ['file', 'documentType'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Document uploaded successfully',
    type: KycDocumentResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file or document type already exists',
  })
  async uploadDocument(
    @Request() req: any,
    @Param('id') verificationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: DocumentUploadDto,
  ): Promise<KycDocumentResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const uploadedFile = {
      fieldname: file.fieldname,
      originalname: file.originalname,
      encoding: file.encoding,
      mimetype: file.mimetype,
      buffer: file.buffer,
      size: file.size,
    };

    return this.kycDocumentService.uploadDocument(
      verificationId,
      uploadedFile,
      dto,
      req.user.id,
      req.user.id,
    );
  }

  @Get('verifications/:id/documents')
  @UseGuards(MerchantAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get KYC documents' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Documents retrieved successfully',
    type: [KycDocumentResponseDto],
  })
  async getDocuments(
    @Request() req: any,
    @Param('id') verificationId: string,
  ): Promise<KycDocumentResponseDto[]> {
    return this.kycDocumentService.getDocuments(verificationId, req.user.id);
  }

  @Get('documents/:documentId')
  @UseGuards(MerchantAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get KYC document by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Document retrieved successfully',
    type: KycDocumentResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Document not found',
  })
  async getDocument(
    @Request() req: any,
    @Param('documentId') documentId: string,
    @Query('verificationId') verificationId?: string,
  ): Promise<KycDocumentResponseDto> {
    return this.kycDocumentService.getDocument(
      documentId,
      verificationId,
      req.user.id,
    );
  }

  @Delete('documents/:documentId')
  @UseGuards(MerchantAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete KYC document' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Document deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot delete document in current status',
  })
  async deleteDocument(
    @Request() req: any,
    @Param('documentId') documentId: string,
    @Query('verificationId') verificationId?: string,
  ): Promise<void> {
    return this.kycDocumentService.deleteDocument(
      documentId,
      verificationId,
      req.user.id,
      req.user.id,
    );
  }
}