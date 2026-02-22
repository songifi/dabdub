import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { MerchantDocumentService } from '../services/merchant-document.service';
import { DocumentRequestService } from '../services/document-request.service';
import { RequestDocumentDto, RejectDocumentDto } from '../dto/merchant-document.dto';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { AdminJwtGuard } from '../../auth/guards/admin-jwt.guard';
import { RequirePermissionGuard } from '../../auth/guards/require-permission.guard';

@ApiTags('Merchant Documents')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RequirePermissionGuard)
@Controller('api/v1/merchants/:id/documents')
export class MerchantDocumentController {
  constructor(
    private readonly documentService: MerchantDocumentService,
    private readonly requestService: DocumentRequestService,
  ) {}

  @Get()
  @RequirePermission('merchants:kyc:review')
  @ApiOperation({ summary: 'List merchant documents' })
  async listDocuments(@Param('id') id: string) {
    return this.documentService.listMerchantDocuments(id);
  }

  @Get(':documentId/download')
  @RequirePermission('merchants:kyc:review')
  @ApiOperation({ summary: 'Get document download URL' })
  async downloadDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Req() req: any,
  ) {
    return this.documentService.getDownloadUrl(id, documentId, req.user.id);
  }

  @Post(':documentId/accept')
  @RequirePermission('merchants:kyc:review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept document' })
  async acceptDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Req() req: any,
  ) {
    return this.documentService.acceptDocument(documentId, req.user.id);
  }

  @Post(':documentId/reject')
  @RequirePermission('merchants:kyc:review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject document' })
  async rejectDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Body() dto: RejectDocumentDto,
    @Req() req: any,
  ) {
    return this.documentService.rejectDocument(documentId, dto.rejectionReason, req.user.id);
  }

  @Post('request')
  @RequirePermission('merchants:kyc:review')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request additional document' })
  async requestDocument(
    @Param('id') id: string,
    @Body() dto: RequestDocumentDto,
  ) {
    return this.requestService.createRequest(id, dto.documentType, dto.message, dto.deadline);
  }
}
