import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { MoreThanOrEqual, Repository } from 'typeorm';
import type { Queue } from 'bull';
import { ReportJob, ReportStatus, ReportType } from './entities/report-job.entity';
import { CreateReportDto } from './dto/create-report.dto';

export const REPORT_QUEUE = 'report-jobs';
export const GENERATE_REPORT_JOB = 'generate-report';
export const CLEANUP_REPORT_JOB = 'cleanup-expired-reports';

const MAX_DATE_RANGE_DAYS = 90;
const MAX_STATEMENT_RANGE_DAYS = 366;
const GDPR_EXPORT_COOLDOWN_DAYS = 30;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ReportJob)
    private readonly repo: Repository<ReportJob>,
    @InjectQueue(REPORT_QUEUE)
    private readonly queue: Queue,
  ) {}

  async create(userId: string, dto: CreateReportDto): Promise<ReportJob> {
    const params = dto.params ?? {};

    // Validate date range ≤ 90 days
    if (params.dateFrom && params.dateTo) {
      const from = new Date(params.dateFrom);
      const to = new Date(params.dateTo);
      const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > MAX_DATE_RANGE_DAYS) {
        throw new BadRequestException('Date range cannot exceed 90 days');
      }
      if (diffDays < 0) {
        throw new BadRequestException('dateFrom must be before dateTo');
      }
    }

    const job = await this.repo.save(
      this.repo.create({
        requestedBy: userId,
        type: dto.type,
        params,
        status: ReportStatus.QUEUED,
      }),
    );

    await this.enqueue(job.id);

    return job;
  }

  async requestGdprExport(userId: string): Promise<{ jobId: string; estimatedReadyAt: string }> {
    const since = new Date(Date.now() - GDPR_EXPORT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    const recent = await this.repo.count({
      where: {
        requestedBy: userId,
        type: ReportType.GDPR_EXPORT,
        createdAt: MoreThanOrEqual(since),
      },
    });

    if (recent > 0) {
      throw new BadRequestException('You can request a GDPR export once every 30 days');
    }

    const job = await this.repo.save(
      this.repo.create({
        requestedBy: userId,
        type: ReportType.GDPR_EXPORT,
        params: {},
        status: ReportStatus.QUEUED,
      }),
    );

    await this.enqueue(job.id);

    return {
      jobId: job.id,
      estimatedReadyAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  async requestAccountStatement(
    userId: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<{ jobId: string; estimatedReadyAt: string }> {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const diffDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid statement date range');
    }
    if (diffDays < 0) {
      throw new BadRequestException('dateFrom must be before dateTo');
    }
    if (diffDays > MAX_STATEMENT_RANGE_DAYS) {
      throw new BadRequestException('Statement range cannot exceed 12 months');
    }

    const job = await this.repo.save(
      this.repo.create({
        requestedBy: userId,
        type: ReportType.ACCOUNT_STATEMENT,
        params: { dateFrom, dateTo },
        status: ReportStatus.QUEUED,
      }),
    );

    await this.enqueue(job.id);

    return {
      jobId: job.id,
      estimatedReadyAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
  }

  async listAccountExports(userId: string): Promise<ReportJob[]> {
    return this.repo
      .createQueryBuilder('r')
      .where('r.requested_by = :userId', { userId })
      .andWhere('r.type IN (:...types)', {
        types: [ReportType.GDPR_EXPORT, ReportType.ACCOUNT_STATEMENT],
      })
      .orderBy('r.created_at', 'DESC')
      .getMany();
  }

  async getAccountExport(userId: string, id: string): Promise<{
    id: string;
    type: ReportType;
    status: ReportStatus;
    requestedAt: Date;
    expiresAt: Date | null;
    downloadUrl: string | null;
    errorMessage: string | null;
  }> {
    const job = await this.repo
      .createQueryBuilder('r')
      .where('r.id = :id', { id })
      .andWhere('r.requested_by = :userId', { userId })
      .andWhere('r.type IN (:...types)', {
        types: [ReportType.GDPR_EXPORT, ReportType.ACCOUNT_STATEMENT],
      })
      .getOne();

    if (!job) {
      throw new NotFoundException('Export job not found');
    }

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      requestedAt: job.createdAt,
      expiresAt: job.expiresAt,
      downloadUrl: job.status === ReportStatus.READY ? job.fileUrl : null,
      errorMessage: job.errorMessage,
    };
  }

  async listForUser(userId: string): Promise<ReportJob[]> {
    return this.repo.find({
      where: { requestedBy: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getForUser(userId: string, id: string): Promise<ReportJob> {
    const job = await this.repo.findOne({ where: { id, requestedBy: userId } });
    if (!job) throw new NotFoundException('Report not found');
    return job;
  }

  async adminList(): Promise<ReportJob[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<ReportJob | null> {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, patch: Partial<ReportJob>): Promise<void> {
    await this.repo.update(id, patch);
  }

  async deleteExpired(): Promise<ReportJob[]> {
    const now = new Date();
    const expired = await this.repo
      .createQueryBuilder('r')
      .where('r.expires_at IS NOT NULL AND r.expires_at < :now', { now })
      .getMany();

    if (expired.length > 0) {
      await this.repo.remove(expired);
    }
    return expired;
  }

  private async enqueue(jobId: string): Promise<void> {
    await this.queue.add(GENERATE_REPORT_JOB, { jobId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
