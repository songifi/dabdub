import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bull';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { EmailService } from '../email/email.service';
import { Merchant, MerchantRole } from '../merchants/entities/merchant.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { Settlement, SettlementStatus } from '../settlements/entities/settlement.entity';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsExport,
  AnalyticsExportFormat,
  AnalyticsExportScope,
  AnalyticsExportStatus,
} from './entities/analytics-export.entity';

export const ANALYTICS_EXPORT_QUEUE = 'analytics-export';

type AnalyticsPeriod = 'daily' | 'monthly';

interface RequestExportOptions {
  requesterId: string;
  requesterRole: MerchantRole;
  format: string;
  period: AnalyticsPeriod;
  dateFrom?: string;
  dateTo?: string;
  deliveryBaseUrl: string;
}

interface ExportMetrics {
  period: AnalyticsPeriod;
  periodLabel: string;
  merchantName: string;
  volumeSeries: Array<{ date: string; count: number; volumeUsd: number }>;
  totalVolumeUsd: number;
  paymentCount: number;
  averagePaymentValueUsd: number;
  highestVolumeBucket: { date: string; volumeUsd: number };
  averageBucketVolumeUsd: number;
  settlementSummary: {
    count: number;
    grossUsd: number;
    netUsd: number;
    feesUsd: number;
  };
  topMetrics: Array<{ label: string; value: string }>;
}

interface TimeRange {
  start: Date;
  endExclusive: Date;
}

@Injectable()
export class AnalyticsExportService {
  private readonly logger = new Logger(AnalyticsExportService.name);

  constructor(
    @InjectRepository(AnalyticsExport)
    private readonly exportRepo: Repository<AnalyticsExport>,
    @InjectRepository(Merchant)
    private readonly merchantsRepo: Repository<Merchant>,
    @InjectRepository(Payment)
    private readonly paymentsRepo: Repository<Payment>,
    @InjectRepository(Settlement)
    private readonly settlementsRepo: Repository<Settlement>,
    @InjectQueue(ANALYTICS_EXPORT_QUEUE)
    private readonly exportQueue: Queue<{ exportId: string }>,
    private readonly analyticsService: AnalyticsService,
    private readonly emailService: EmailService,
  ) {}

  async requestExport(options: RequestExportOptions) {
    const { requesterId, requesterRole, format, period, dateFrom, dateTo, deliveryBaseUrl } =
      options;

    if (format !== AnalyticsExportFormat.PDF) {
      throw new BadRequestException('Only pdf exports are supported');
    }

    const requester = await this.merchantsRepo.findOne({ where: { id: requesterId } });
    if (!requester) {
      throw new NotFoundException('Merchant not found');
    }

    const scope =
      requesterRole === MerchantRole.ADMIN || requesterRole === MerchantRole.SUPERADMIN
        ? AnalyticsExportScope.ADMIN
        : AnalyticsExportScope.MERCHANT;

    const exportRecord = await this.exportRepo.save(
      this.exportRepo.create({
        format: AnalyticsExportFormat.PDF,
        scope,
        status: AnalyticsExportStatus.QUEUED,
        requestedByMerchantId: requester.id,
        merchantId: scope === AnalyticsExportScope.MERCHANT ? requester.id : null,
        recipientEmail: requester.email,
        merchantBusinessName: requester.businessName,
        period,
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
        deliveryBaseUrl: deliveryBaseUrl.replace(/\/$/, ''),
        fileName: null,
        fileData: null,
        downloadToken: null,
        expiresAt: null,
        errorMessage: null,
      }),
    );

    await this.exportQueue.add(
      'generate',
      { exportId: exportRecord.id },
      { removeOnComplete: true, removeOnFail: false },
    );

    return {
      exportId: exportRecord.id,
      status: exportRecord.status,
      message: 'Analytics export queued',
    };
  }

  async generateExport(exportId: string): Promise<void> {
    const exportRecord = await this.exportRepo.findOne({ where: { id: exportId } });
    if (!exportRecord) {
      this.logger.warn(`Analytics export not found: ${exportId}`);
      return;
    }

    exportRecord.status = AnalyticsExportStatus.PROCESSING;
    exportRecord.errorMessage = null;
    await this.exportRepo.save(exportRecord);

    try {
      const metrics = await this.buildMetrics(exportRecord);
      const buffer = this.buildPdf(metrics);
      const token = randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const fileName = this.buildFileName(exportRecord, metrics);

      exportRecord.fileName = fileName;
      exportRecord.fileData = buffer;
      exportRecord.downloadToken = token;
      exportRecord.expiresAt = expiresAt;
      exportRecord.status = AnalyticsExportStatus.READY;
      await this.exportRepo.save(exportRecord);

      await this.emailService.queue(
        exportRecord.recipientEmail,
        'analytics-report-ready',
        {
          merchantName: exportRecord.merchantBusinessName,
          reportName: fileName,
          downloadUrl: `${exportRecord.deliveryBaseUrl}/export/download/${token}`,
          expiresAt: expiresAt.toISOString(),
        },
        exportRecord.requestedByMerchantId,
      );
    } catch (error) {
      exportRecord.status = AnalyticsExportStatus.FAILED;
      exportRecord.errorMessage = error instanceof Error ? error.message : String(error);
      await this.exportRepo.save(exportRecord);
      throw error;
    }
  }

  async getDownloadByToken(token: string): Promise<AnalyticsExport> {
    const exportRecord = await this.exportRepo.findOne({
      where: { downloadToken: token },
    });

    if (!exportRecord || !exportRecord.fileData || exportRecord.status !== AnalyticsExportStatus.READY) {
      throw new NotFoundException('Analytics export not found');
    }

    if (exportRecord.expiresAt && exportRecord.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Download link expired');
    }

    return exportRecord;
  }

  private async buildMetrics(exportRecord: AnalyticsExport): Promise<ExportMetrics> {
    const period = exportRecord.period;
    const merchantName = exportRecord.merchantBusinessName;
    const volumeSeries = await this.analyticsService.getVolume({
      scope:
        exportRecord.scope === AnalyticsExportScope.ADMIN ? 'admin' : 'merchant',
      merchantId: exportRecord.merchantId ?? undefined,
      period,
      dateFrom: exportRecord.dateFrom ?? undefined,
      dateTo: exportRecord.dateTo ?? undefined,
    });

    const totalVolumeUsd = volumeSeries.reduce((sum, item) => sum + item.volumeUsd, 0);
    const paymentCount = volumeSeries.reduce((sum, item) => sum + item.count, 0);
    const averagePaymentValueUsd = paymentCount > 0 ? totalVolumeUsd / paymentCount : 0;
    const highestVolumeBucket = volumeSeries.reduce(
      (best, item) => (item.volumeUsd > best.volumeUsd ? item : best),
      volumeSeries[0] ?? { date: 'N/A', count: 0, volumeUsd: 0 },
    );
    const averageBucketVolumeUsd =
      volumeSeries.length > 0 ? totalVolumeUsd / volumeSeries.length : 0;

    const range = this.resolveRange(
      period,
      exportRecord.dateFrom ?? undefined,
      exportRecord.dateTo ?? undefined,
    );
    const settlementSummary = await this.getSettlementSummary(exportRecord, range);
    const periodLabel =
      volumeSeries.length > 0
        ? `${volumeSeries[0].date} to ${volumeSeries[volumeSeries.length - 1].date}`
        : `${this.formatRangeLabel(range.start, period)} to ${this.formatRangeLabel(
            this.previousMoment(range.endExclusive, period),
            period,
          )}`;

    return {
      period,
      periodLabel,
      merchantName,
      volumeSeries,
      totalVolumeUsd,
      paymentCount,
      averagePaymentValueUsd,
      highestVolumeBucket: {
        date: highestVolumeBucket.date,
        volumeUsd: highestVolumeBucket.volumeUsd,
      },
      averageBucketVolumeUsd,
      settlementSummary,
      topMetrics: [
        {
          label: 'Highest Volume Bucket',
          value: `${highestVolumeBucket.date}: ${this.formatUsd(highestVolumeBucket.volumeUsd)}`,
        },
        {
          label: 'Average Bucket Volume',
          value: this.formatUsd(averageBucketVolumeUsd),
        },
        {
          label: 'Fee Revenue',
          value: this.formatUsd(settlementSummary.feesUsd),
        },
        {
          label: 'Average Payment Value',
          value: this.formatUsd(averagePaymentValueUsd),
        },
      ],
    };
  }

  private async getSettlementSummary(
    exportRecord: AnalyticsExport,
    range: TimeRange,
  ): Promise<ExportMetrics['settlementSummary']> {
    const timestampExpression =
      'COALESCE("settlement"."completedAt", "settlement"."createdAt")';
    const query = this.settlementsRepo
      .createQueryBuilder('settlement')
      .select('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM("settlement"."totalAmountUsd"), 0)::numeric(18,6)::text', 'grossUsd')
      .addSelect('COALESCE(SUM("settlement"."netAmountUsd"), 0)::numeric(18,6)::text', 'netUsd')
      .addSelect('COALESCE(SUM("settlement"."feeAmountUsd"), 0)::numeric(18,6)::text', 'feesUsd')
      .where('"settlement"."status" = :status', { status: SettlementStatus.COMPLETED })
      .andWhere(`${timestampExpression} >= :start`, { start: range.start })
      .andWhere(`${timestampExpression} < :end`, { end: range.endExclusive });

    if (exportRecord.merchantId) {
      query.andWhere('"settlement"."merchantId" = :merchantId', {
        merchantId: exportRecord.merchantId,
      });
    }

    const result = await query.getRawOne<{
      count: string;
      grossUsd: string;
      netUsd: string;
      feesUsd: string;
    }>();

    return {
      count: Number(result?.count ?? 0),
      grossUsd: Number(result?.grossUsd ?? 0),
      netUsd: Number(result?.netUsd ?? 0),
      feesUsd: Number(result?.feesUsd ?? 0),
    };
  }

  private resolveRange(
    period: AnalyticsPeriod,
    dateFrom?: string,
    dateTo?: string,
  ): TimeRange {
    if (period === 'daily') {
      const endInclusive = dateTo ? this.parseIsoDate(dateTo) : this.startOfUtcDay(new Date());
      const start = dateFrom ? this.parseIsoDate(dateFrom) : this.addUtcDays(endInclusive, -29);

      if (start > endInclusive) {
        throw new BadRequestException('"dateFrom" must be before or equal to "dateTo"');
      }

      return { start, endExclusive: this.addUtcDays(endInclusive, 1) };
    }

    const endMonth = dateTo
      ? this.startOfUtcMonth(this.parseIsoDate(dateTo))
      : this.startOfUtcMonth(new Date());
    const startMonth = dateFrom
      ? this.startOfUtcMonth(this.parseIsoDate(dateFrom))
      : this.addUtcMonths(endMonth, -11);

    if (startMonth > endMonth) {
      throw new BadRequestException('"dateFrom" must be before or equal to "dateTo"');
    }

    return { start: startMonth, endExclusive: this.addUtcMonths(endMonth, 1) };
  }

  private buildFileName(exportRecord: AnalyticsExport, metrics: ExportMetrics): string {
    const scopePrefix =
      exportRecord.scope === AnalyticsExportScope.ADMIN ? 'platform' : 'merchant';
    const sanitizedName = metrics.merchantName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${scopePrefix}-analytics-report-${sanitizedName}-${Date.now()}.pdf`;
  }

  private buildPdf(metrics: ExportMetrics): Buffer {
    const width = 842;
    const height = 595;
    const commands: string[] = [];

    const text = (x: number, y: number, size: number, value: string) => {
      commands.push(`BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${this.escapePdfText(value)}) Tj ET`);
    };

    const line = (x1: number, y1: number, x2: number, y2: number) => {
      commands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
    };

    const fillRect = (
      x: number,
      y: number,
      rectWidth: number,
      rectHeight: number,
      r: number,
      g: number,
      b: number,
    ) => {
      commands.push(`${r} ${g} ${b} rg ${x} ${y} ${rectWidth} ${rectHeight} re f`);
    };

    fillRect(0, 0, width, height, 1, 1, 1);
    fillRect(0, 535, width, 60, 0.93, 0.78, 0.18);
    text(40, 555, 22, `${metrics.merchantName} Analytics Report`);
    text(40, 535, 11, `Period: ${metrics.periodLabel}`);
    text(650, 555, 10, `Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);

    text(40, 500, 16, 'Volume Chart');
    const chartLeft = 40;
    const chartBottom = 275;
    const chartWidth = 470;
    const chartHeight = 180;
    commands.push('0.20 0.20 0.20 RG 1 w');
    line(chartLeft, chartBottom, chartLeft, chartBottom + chartHeight);
    line(chartLeft, chartBottom, chartLeft + chartWidth, chartBottom);

    const maxVolume = Math.max(...metrics.volumeSeries.map((item) => item.volumeUsd), 1);
    const barGap = 4;
    const barWidth = Math.max(
      4,
      (chartWidth - barGap * Math.max(metrics.volumeSeries.length - 1, 0)) /
        Math.max(metrics.volumeSeries.length, 1),
    );

    metrics.volumeSeries.forEach((item, index) => {
      const barHeight = (item.volumeUsd / maxVolume) * (chartHeight - 10);
      const x = chartLeft + index * (barWidth + barGap);
      fillRect(x, chartBottom, barWidth, barHeight, 0.94, 0.70, 0.18);

      const labelStep = Math.max(1, Math.ceil(metrics.volumeSeries.length / 6));
      if (index % labelStep === 0 || index === metrics.volumeSeries.length - 1) {
        text(x, chartBottom - 18, 8, item.date);
      }
    });

    text(chartLeft, chartBottom + chartHeight + 8, 9, `Max volume: ${this.formatUsd(maxVolume)}`);

    text(550, 500, 16, 'Key Stats');
    text(550, 475, 11, `Total Volume: ${this.formatUsd(metrics.totalVolumeUsd)}`);
    text(550, 455, 11, `Payment Count: ${metrics.paymentCount}`);
    text(550, 435, 11, `Average Payment: ${this.formatUsd(metrics.averagePaymentValueUsd)}`);
    text(550, 415, 11, `Report Period: ${metrics.period}`);

    text(40, 235, 16, 'Settlement Summary');
    text(40, 210, 11, `Completed Settlements: ${metrics.settlementSummary.count}`);
    text(40, 190, 11, `Gross Settled: ${this.formatUsd(metrics.settlementSummary.grossUsd)}`);
    text(40, 170, 11, `Net Settled: ${this.formatUsd(metrics.settlementSummary.netUsd)}`);
    text(40, 150, 11, `Fees Collected: ${this.formatUsd(metrics.settlementSummary.feesUsd)}`);

    text(550, 235, 16, 'Top Metrics');
    metrics.topMetrics.forEach((metric, index) => {
      text(550, 210 - index * 22, 11, `${metric.label}: ${metric.value}`);
    });

    const content = commands.join('\n');
    return this.createPdfDocument(content);
  }

  private createPdfDocument(content: string): Buffer {
    const stream = Buffer.from(content, 'utf8');
    const streamContent = stream.toString('utf8');
    const objects = [
      '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
      '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
      '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
      '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
      `5 0 obj << /Length ${stream.length} >> stream\n${streamContent}\nendstream endobj`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];

    for (const object of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += `${object}\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    offsets.forEach((offset) => {
      pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }

  private escapePdfText(value: string): string {
    return value
      .replace(/[^\x20-\x7E]/g, '?')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  private formatUsd(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  private parseIsoDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException('Dates must use YYYY-MM-DD format');
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date: ${value}`);
    }

    return parsed;
  }

  private startOfUtcDay(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private startOfUtcMonth(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  }

  private addUtcDays(value: Date, days: number): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + days),
    );
  }

  private addUtcMonths(value: Date, months: number): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1));
  }

  private previousMoment(value: Date, period: AnalyticsPeriod): Date {
    return period === 'daily' ? this.addUtcDays(value, -1) : this.addUtcDays(value, -1);
  }

  private formatRangeLabel(value: Date, period: AnalyticsPeriod): string {
    return period === 'daily'
      ? value.toISOString().slice(0, 10)
      : value.toISOString().slice(0, 7);
  }
}
