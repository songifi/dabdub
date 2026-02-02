import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { KycVerificationService } from '../services/kyc-verification.service';
import { KycAuditService } from '../services/kyc-audit.service';
import {
  ReviewKycVerificationDto,
  KycVerificationResponseDto,
  KycStatusQueryDto,
} from '../dto/kyc-verification.dto';
import { KycAuditLog } from '../entities/kyc-audit-log.entity';

@ApiTags('KYC Admin')
@Controller('api/v1/admin/kyc')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class KycAdminController {
  constructor(
    private readonly kycVerificationService: KycVerificationService,
    private readonly kycAuditService: KycAuditService,
  ) {}

  @Get('verifications')
  @ApiOperation({ summary: 'Get all KYC verifications (Admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'KYC verifications retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/KycVerificationResponseDto' },
        },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async getVerifications(
    @Query() query: KycStatusQueryDto,
  ): Promise<{
    data: KycVerificationResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.kycVerificationService.getVerifications(query);
  }

  @Get('verifications/:id')
  @ApiOperation({ summary: 'Get KYC verification by ID (Admin)' })
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
    @Param('id') verificationId: string,
  ): Promise<KycVerificationResponseDto> {
    return this.kycVerificationService.getVerification(verificationId);
  }

  @Put('verifications/:id/review')
  @ApiOperation({ summary: 'Review KYC verification (Admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'KYC verification reviewed successfully',
    type: KycVerificationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot review verification in current status',
  })
  async reviewVerification(
    @Request() req: any,
    @Param('id') verificationId: string,
    @Body() dto: ReviewKycVerificationDto,
  ): Promise<KycVerificationResponseDto> {
    return this.kycVerificationService.reviewVerification(
      verificationId,
      dto,
      req.user.id,
    );
  }

  @Get('verifications/:id/audit-logs')
  @ApiOperation({ summary: 'Get KYC verification audit logs (Admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit logs retrieved successfully',
    type: [KycAuditLog],
  })
  async getAuditLogs(
    @Param('id') verificationId: string,
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0,
  ): Promise<KycAuditLog[]> {
    return this.kycAuditService.getAuditLogs(verificationId, limit, offset);
  }

  @Get('audit-logs/compliance')
  @ApiOperation({ summary: 'Get compliance audit logs (Admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compliance audit logs retrieved successfully',
    type: [KycAuditLog],
  })
  async getComplianceAuditLogs(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit: number = 1000,
    @Query('offset') offset: number = 0,
  ): Promise<KycAuditLog[]> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    return this.kycAuditService.getComplianceAuditLogs(start, end, limit, offset);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get KYC statistics (Admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'KYC statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalVerifications: { type: 'number' },
        pendingReview: { type: 'number' },
        approved: { type: 'number' },
        rejected: { type: 'number' },
        expired: { type: 'number' },
        riskDistribution: {
          type: 'object',
          properties: {
            low: { type: 'number' },
            medium: { type: 'number' },
            high: { type: 'number' },
            veryHigh: { type: 'number' },
          },
        },
        averageProcessingTime: { type: 'number' },
        complianceMetrics: {
          type: 'object',
          properties: {
            sanctionsChecked: { type: 'number' },
            sanctionsMatches: { type: 'number' },
            documentsProcessed: { type: 'number' },
            documentsRejected: { type: 'number' },
          },
        },
      },
    },
  })
  async getStatistics(): Promise<any> {
    // This would be implemented to return comprehensive KYC statistics
    // For now, returning a placeholder structure
    return {
      totalVerifications: 0,
      pendingReview: 0,
      approved: 0,
      rejected: 0,
      expired: 0,
      riskDistribution: {
        low: 0,
        medium: 0,
        high: 0,
        veryHigh: 0,
      },
      averageProcessingTime: 0,
      complianceMetrics: {
        sanctionsChecked: 0,
        sanctionsMatches: 0,
        documentsProcessed: 0,
        documentsRejected: 0,
      },
    };
  }

  @Get('reports/compliance')
  @ApiOperation({ summary: 'Generate compliance report (Admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compliance report generated successfully',
    schema: {
      type: 'object',
      properties: {
        reportId: { type: 'string' },
        generatedAt: { type: 'string', format: 'date-time' },
        period: {
          type: 'object',
          properties: {
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
          },
        },
        summary: {
          type: 'object',
          properties: {
            totalVerifications: { type: 'number' },
            approvedVerifications: { type: 'number' },
            rejectedVerifications: { type: 'number' },
            sanctionsScreenings: { type: 'number' },
            sanctionsMatches: { type: 'number' },
            highRiskCases: { type: 'number' },
            manualReviews: { type: 'number' },
          },
        },
        downloadUrl: { type: 'string' },
      },
    },
  })
  async generateComplianceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('format') format: string = 'pdf',
  ): Promise<any> {
    // This would generate a comprehensive compliance report
    // For now, returning a placeholder structure
    const reportId = `compliance_${Date.now()}`;
    
    return {
      reportId,
      generatedAt: new Date().toISOString(),
      period: {
        startDate,
        endDate,
      },
      summary: {
        totalVerifications: 0,
        approvedVerifications: 0,
        rejectedVerifications: 0,
        sanctionsScreenings: 0,
        sanctionsMatches: 0,
        highRiskCases: 0,
        manualReviews: 0,
      },
      downloadUrl: `/api/v1/admin/kyc/reports/${reportId}/download`,
    };
  }
}