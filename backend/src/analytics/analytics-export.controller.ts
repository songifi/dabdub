import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { MerchantRole } from '../merchants/entities/merchant.entity';
import { AnalyticsExportFormat } from './entities/analytics-export.entity';
import { AnalyticsExportService } from './analytics-export.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsExportController {
  constructor(private readonly analyticsExportService: AnalyticsExportService) {}

  @Post('export')
  @ApiOperation({ summary: 'Queue an analytics export' })
  @ApiQuery({ name: 'format', required: false, enum: ['pdf'] })
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'monthly'] })
  @ApiQuery({ name: 'dateFrom', required: false, description: 'Start date in YYYY-MM-DD format' })
  @ApiQuery({ name: 'dateTo', required: false, description: 'End date in YYYY-MM-DD format' })
  @ApiOkResponse({ description: 'Export queued successfully' })
  @ApiResponse({ status: 400, description: 'Invalid export request' })
  queueExport(
    @Req() req: Request & { user: { merchantId: string; role: MerchantRole } },
    @Query('format') format: string = AnalyticsExportFormat.PDF,
    @Query('period') period: 'daily' | 'monthly' = 'daily',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const protocol = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol;
    const deliveryBaseUrl = `${protocol}://${req.get('host')}${req.baseUrl}`;

    return this.analyticsExportService.requestExport({
      requesterId: req.user.merchantId,
      requesterRole: req.user.role,
      format,
      period,
      dateFrom,
      dateTo,
      deliveryBaseUrl,
    });
  }
}

@ApiTags('analytics')
@Controller('analytics/export')
export class AnalyticsExportDownloadController {
  constructor(private readonly analyticsExportService: AnalyticsExportService) {}

  @Get('download/:token')
  @ApiOperation({ summary: 'Download an analytics export by token' })
  @ApiOkResponse({ description: 'PDF export download' })
  @ApiResponse({ status: 404, description: 'Export not found' })
  @ApiResponse({ status: 410, description: 'Export link expired' })
  async downloadExport(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const exportRecord = await this.analyticsExportService.getDownloadByToken(token);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exportRecord.fileName ?? 'analytics-report.pdf'}"`,
    );
    res.send(exportRecord.fileData);
  }
}
