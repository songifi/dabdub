import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import {
  REVENUE_EXPORT_QUEUE,
  RevenueExportJobPayload,
} from './revenue-export.processor';
import { RevenueOverviewService } from './revenue-overview.service';
import { RevenueExportResponseDto } from './dto/revenue-overview.dto';

export interface RevenueExportJobRecord {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimatedRows: number;
  createdAt: Date;
  completedAt?: Date;
  csv?: string;
  error?: string;
}

@Injectable()
export class RevenueExportService {
  private readonly jobs = new Map<string, RevenueExportJobRecord>();

  constructor(
    @InjectQueue(REVENUE_EXPORT_QUEUE) private readonly queue: Queue,
    private readonly revenueOverviewService: RevenueOverviewService,
  ) {}

  async enqueueExport(
    period: string,
    requestedByEmail?: string,
  ): Promise<RevenueExportResponseDto> {
    const { startDate, endDate } = this.revenueOverviewService.parsePeriod(period);
    const estimatedRows = await this.revenueOverviewService.getEstimatedExportRows(period);
    const jobId = uuidv4();

    const record: RevenueExportJobRecord = {
      jobId,
      status: 'pending',
      estimatedRows,
      createdAt: new Date(),
    };
    this.jobs.set(jobId, record);

    const payload: RevenueExportJobPayload = {
      jobId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      requestedByEmail,
    };

    await this.queue.add('generate', payload, { jobId });

    return {
      jobId,
      estimatedRows,
      message:
        'Export queued. You will receive an email when it is ready.',
    };
  }

  getJob(jobId: string): RevenueExportJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  setJobStatus(
    jobId: string,
    status: RevenueExportJobRecord['status'],
    csv?: string,
    error?: string,
  ): void {
    const record = this.jobs.get(jobId);
    if (record) {
      record.status = status;
      record.completedAt = new Date();
      if (csv) record.csv = csv;
      if (error) record.error = error;
    }
  }
}
