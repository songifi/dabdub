import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import type { Queue } from 'bull';
import { ReportJob, ReportStatus } from './entities/report-job.entity';
import { CreateReportDto } from './dto/create-report.dto';

export const REPORT_QUEUE = 'report-jobs';
export const GENERATE_REPORT_JOB = 'generate-report';
export const CLEANUP_REPORT_JOB = 'cleanup-expired-reports';

const MAX_DATE_RANGE_DAYS = 90;

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

    await this.queue.add(GENERATE_REPORT_JOB, { jobId: job.id }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    });

    return job;
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
}
