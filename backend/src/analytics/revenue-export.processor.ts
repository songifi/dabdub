import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Settlement,
  SettlementStatus,
} from '../settlement/entities/settlement.entity';
import { RevenueExportService } from './revenue-export.service';

export const REVENUE_EXPORT_QUEUE = 'revenue-export';

export interface RevenueExportJobPayload {
  jobId: string;
  startDate: string; // ISO
  endDate: string;
  requestedByEmail?: string;
}

const CSV_HEADER =
  'transactionId,merchantId,businessName,chain,tokenSymbol,usdAmount,feePercentage,feeUsd,settledAt,settlementId';

@Processor(REVENUE_EXPORT_QUEUE)
export class RevenueExportProcessor {
  constructor(
    @InjectRepository(Settlement)
    private readonly settlementRepository: Repository<Settlement>,
    private readonly revenueExportService: RevenueExportService,
  ) {}

  @Process('generate')
  async handleExport(job: Job<RevenueExportJobPayload>): Promise<void> {
    const { jobId, startDate, endDate, requestedByEmail } = job.data;
    this.revenueExportService.setJobStatus(jobId, 'processing');

    const start = new Date(startDate);
    const end = new Date(endDate);

    try {
      const rows = await this.settlementRepository
      .createQueryBuilder('s')
      .innerJoin('s.paymentRequest', 'pr')
      .innerJoin('s.merchant', 'm')
      .select([
        'pr.id AS "transactionId"',
        'm.id AS "merchantId"',
        'm.business_name AS "businessName"',
        'pr.stellar_network AS "chain"',
        'pr.currency AS "tokenSymbol"',
        'pr.amount AS "usdAmount"',
        's.fee_percentage AS "feePercentage"',
        's.fee_amount AS "feeUsd"',
        's.settled_at AS "settledAt"',
        's.id AS "settlementId"',
      ])
      .where('s.status = :status', { status: SettlementStatus.COMPLETED })
      .andWhere('s.settled_at BETWEEN :start AND :end', { start, end })
      .orderBy('s.settled_at', 'ASC')
      .getRawMany();

    const escape = (v: unknown): string => {
      if (v == null) return '';
      const s = String(v);
      if (/[,"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [
      CSV_HEADER,
      ...rows.map(
        (r) =>
          [
            escape(r.transactionId),
            escape(r.merchantId),
            escape(r.businessName),
            escape(r.chain),
            escape(r.tokenSymbol),
            escape(r.usdAmount),
            escape(r.feePercentage),
            escape(r.feeUsd),
            escape(r.settledAt instanceof Date ? r.settledAt.toISOString() : r.settledAt),
            escape(r.settlementId),
          ].join(','),
      ),
    ];
      const csv = lines.join('\n');
      this.revenueExportService.setJobStatus(jobId, 'completed', csv);

      // TODO: send email when ready (e.g. NotificationService.sendMail(requestedByEmail, 'Revenue export ready', ...))
      if (requestedByEmail) {
        // Placeholder: integrate with notification module to email link to download
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.revenueExportService.setJobStatus(jobId, 'failed', undefined, message);
      throw err;
    }
  }
}
