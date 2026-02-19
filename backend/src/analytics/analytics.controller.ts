import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { ReportService } from './report.service';
import { RevenueOverviewService } from './revenue-overview.service';
import { RevenueExportService } from './revenue-export.service';
import {
  DateRangeDto,
  DateRangeQueryDto,
  TimeInterval,
} from './dto/date-range.dto';
import {
  DashboardMetricsDto,
  RevenueResponseDto,
  TransactionTrendsResponseDto,
  SettlementStatisticsDto,
  NetworkUsageResponseDto,
  PerformanceMetricsDto,
  CustomerInsightDto,
  ReportGenerateDto,
} from './dto/analytics-response.dto';
import { GenerateReportDto, ReportFormat } from './dto/report.dto';
import {
  RevenueQueryDto,
  RevenueOverviewResponseDto,
  RevenueExportQueryDto,
  RevenueExportResponseDto,
  RevenueGranularity,
} from './dto/revenue-overview.dto';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RequirePermissionGuard } from '../auth/guards/require-permission.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';

@ApiTags('Analytics')
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly reportService: ReportService,
    private readonly revenueOverviewService: RevenueOverviewService,
    private readonly revenueExportService: RevenueExportService,
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get dashboard overview metrics',
    description:
      'Returns comprehensive dashboard metrics including revenue, transactions, settlements, and customer data',
  })
  @ApiQuery({ name: 'merchantId', required: true, description: 'Merchant ID' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Start date (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'End date (ISO 8601)',
    example: '2024-01-31T23:59:59Z',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dashboard metrics retrieved successfully',
    type: DashboardMetricsDto,
  })
  async getDashboard(
    @Query('merchantId') merchantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<DashboardMetricsDto> {
    return this.analyticsService.getDashboardMetrics(
      merchantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('revenue')
  @ApiOperation({
    summary: 'Get revenue data with date range support',
    description:
      'Returns revenue data grouped by time interval with growth metrics',
  })
  @ApiQuery({ name: 'merchantId', required: true, description: 'Merchant ID' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'End date (ISO 8601)',
  })
  @ApiQuery({
    name: 'interval',
    required: false,
    enum: TimeInterval,
    description: 'Time interval for grouping',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Revenue data retrieved successfully',
    type: RevenueResponseDto,
  })
  async getRevenue(
    @Query('merchantId') merchantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('interval') interval: TimeInterval = TimeInterval.DAY,
  ): Promise<RevenueResponseDto> {
    return this.analyticsService.getRevenueData(
      merchantId,
      new Date(startDate),
      new Date(endDate),
      interval,
    );
  }

  @Get('transactions/trends')
  @ApiOperation({
    summary: 'Get transaction trends',
    description:
      'Returns transaction trends with success/failure rates over time',
  })
  @ApiQuery({ name: 'merchantId', required: true, description: 'Merchant ID' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'End date (ISO 8601)',
  })
  @ApiQuery({
    name: 'interval',
    required: false,
    enum: TimeInterval,
    description: 'Time interval for grouping',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Transaction trends retrieved successfully',
    type: TransactionTrendsResponseDto,
  })
  async getTransactionTrends(
    @Query('merchantId') merchantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('interval') interval: TimeInterval = TimeInterval.DAY,
  ): Promise<TransactionTrendsResponseDto> {
    return this.analyticsService.getTransactionTrendsData(
      merchantId,
      new Date(startDate),
      new Date(endDate),
      interval,
    );
  }

  @Get('settlements/statistics')
  @ApiOperation({
    summary: 'Get settlement statistics',
    description:
      'Returns comprehensive settlement statistics including success rates and timing',
  })
  @ApiQuery({ name: 'merchantId', required: true, description: 'Merchant ID' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'End date (ISO 8601)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Settlement statistics retrieved successfully',
    type: SettlementStatisticsDto,
  })
  async getSettlementStatistics(
    @Query('merchantId') merchantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<SettlementStatisticsDto> {
    return this.analyticsService.getSettlementStatistics(
      merchantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('networks/usage')
  @ApiOperation({
    summary: 'Get network usage statistics',
    description: 'Returns usage statistics for different blockchain networks',
  })
  @ApiQuery({ name: 'merchantId', required: true, description: 'Merchant ID' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'End date (ISO 8601)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Network usage statistics retrieved successfully',
    type: NetworkUsageResponseDto,
  })
  async getNetworkUsage(
    @Query('merchantId') merchantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<NetworkUsageResponseDto> {
    return this.analyticsService.getNetworkUsage(
      merchantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('performance')
  @ApiOperation({
    summary: 'Get performance metrics',
    description:
      'Returns performance metrics including success rates and processing times',
  })
  @ApiQuery({ name: 'merchantId', required: true, description: 'Merchant ID' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'End date (ISO 8601)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Performance metrics retrieved successfully',
    type: PerformanceMetricsDto,
  })
  async getPerformance(
    @Query('merchantId') merchantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<PerformanceMetricsDto> {
    return this.analyticsService.getPerformanceMetrics(
      merchantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('customers/insights')
  @ApiOperation({
    summary: 'Get customer insights',
    description:
      'Returns customer analytics including new vs returning customers and top customers',
  })
  @ApiQuery({ name: 'merchantId', required: true, description: 'Merchant ID' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'End date (ISO 8601)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Customer insights retrieved successfully',
    type: CustomerInsightDto,
  })
  async getCustomerInsights(
    @Query('merchantId') merchantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<CustomerInsightDto> {
    return this.analyticsService.getCustomerInsights(
      merchantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Post('reports/generate')
  @ApiOperation({
    summary: 'Generate analytics report',
    description:
      'Generates a comprehensive analytics report in the specified format',
  })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Report generation started',
    type: ReportGenerateDto,
  })
  async generateReport(
    @Body() generateReportDto: GenerateReportDto,
  ): Promise<ReportGenerateDto> {
    const merchantId = generateReportDto.merchantId || 'default-merchant';
    const reportId = await this.reportService.generateReport(
      merchantId,
      generateReportDto.type,
      new Date(generateReportDto.startDate),
      new Date(generateReportDto.endDate),
      generateReportDto.format || ReportFormat.CSV,
    );

    return {
      reportId,
      status: 'pending',
      type: generateReportDto.type,
      estimatedCompletion: new Date(Date.now() + 60000).toISOString(), // 1 minute estimate
    };
  }

  @Get('reports/:id/download')
  @ApiOperation({
    summary: 'Download generated report',
    description: 'Downloads a previously generated report',
  })
  @ApiParam({ name: 'id', description: 'Report ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Report downloaded successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Report not found',
  })
  async downloadReport(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const report = await this.reportService.getReportStatus(id);

    if (!report) {
      res.status(HttpStatus.NOT_FOUND).json({
        success: false,
        message: 'Report not found',
      });
      return;
    }

    if (report.status !== 'completed') {
      res.status(HttpStatus.ACCEPTED).json({
        success: false,
        message: `Report is ${report.status}`,
        status: report.status,
      });
      return;
    }

    const data = await this.reportService.downloadReport(id);
    const extension = report.format === ReportFormat.JSON ? 'json' : 'csv';
    const contentType =
      report.format === ReportFormat.JSON ? 'application/json' : 'text/csv';

    res.header('Content-Type', contentType);
    res.header(
      'Content-Disposition',
      `attachment; filename=report-${id}.${extension}`,
    );
    res.send(data);
  }

  // Legacy endpoints for backward compatibility
  @Get('reports/export')
  @ApiOperation({
    summary: 'Export merchant report (legacy)',
    deprecated: true,
  })
  async exportReport(
    @Query('merchantId') merchantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.reportService.generateMerchantReportCsv(
      merchantId,
      new Date(startDate),
      new Date(endDate),
    );
    res.header('Content-Type', 'text/csv');
    res.header(
      'Content-Disposition',
      `attachment; filename=report-${merchantId}-${startDate}.csv`,
    );
    res.send(csv);
  }

  @Get('merchants/:merchantId/volume')
  @ApiOperation({ summary: 'Get payment volume (legacy)', deprecated: true })
  async getPaymentVolume(
    @Param('merchantId') merchantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getPaymentVolume(
      merchantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('merchants/:merchantId/settlements/rate')
  @ApiOperation({
    summary: 'Get settlement success rate (legacy)',
    deprecated: true,
  })
  async getSettlementSuccessRate(@Param('merchantId') merchantId: string) {
    return this.analyticsService.getSettlementSuccessRate(merchantId);
  }

  @Get('merchants/:merchantId/revenue')
  @ApiOperation({ summary: 'Get merchant revenue (legacy)', deprecated: true })
  async getMerchantRevenue(@Param('merchantId') merchantId: string) {
    return this.analyticsService.getMerchantRevenue(merchantId);
  }

  @Get('merchants/:merchantId/trends')
  @ApiOperation({
    summary: 'Get transaction trends (legacy)',
    deprecated: true,
  })
  async getTransactionTrendsLegacy(
    @Param('merchantId') merchantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('interval') interval: 'day' | 'week' | 'month' = 'day',
  ) {
    return this.analyticsService.getTransactionTrends(
      merchantId,
      new Date(startDate),
      new Date(endDate),
      interval,
    );
  }

  @Get('merchants/:merchantId/fees')
  @ApiOperation({ summary: 'Get fee analysis (legacy)', deprecated: true })
  async getFeeAnalysis(
    @Param('merchantId') merchantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getFeeAnalysis(
      merchantId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('merchants/:merchantId/growth')
  @ApiOperation({ summary: 'Get merchant growth (legacy)', deprecated: true })
  async getMerchantGrowth(
    @Param('merchantId') merchantId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.analyticsService.getMerchantGrowth(
      merchantId,
      new Date(startDate),
      new Date(endDate),
    );
  }
}
