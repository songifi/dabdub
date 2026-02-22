import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { MerchantDocumentService } from '../services/merchant-document.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { AdminJwtGuard } from '../../auth/guards/admin-jwt.guard';
import { RequirePermissionGuard } from '../../auth/guards/require-permission.guard';

@ApiTags('Admin Documents')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RequirePermissionGuard)
@Controller('api/v1/documents')
export class AdminDocumentController {
  constructor(private readonly documentService: MerchantDocumentService) {}

  @Get('expiring')
  @RequirePermission('merchants:read')
  @ApiOperation({ summary: 'List documents expiring soon' })
  async getExpiringDocuments(
    @Query('withinDays') withinDays?: number,
    @Query('documentType') documentType?: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.documentService.getExpiringDocuments(withinDays, documentType, page, limit);
  }

  @Post('expiring/:documentId/send-renewal-request')
  @RequirePermission('merchants:kyc:review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send renewal reminder to merchant' })
  async sendRenewalRequest(@Param('documentId') documentId: string) {
    return this.documentService.sendRenewalRequest(documentId);
  }
}
