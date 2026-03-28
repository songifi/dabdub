import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportsService, REPORT_QUEUE, GENERATE_REPORT_JOB } from './reports.service';
import { ReportJob, ReportStatus, ReportType } from './entities/report-job.entity';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRepo = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'bull-job-1' }),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeJob = (overrides: Partial<ReportJob> = {}): ReportJob =>
  ({
    id: 'report-uuid-1',
    requestedBy: 'user-uuid-1',
    type: ReportType.USER_TRANSACTIONS,
    params: { dateFrom: '2025-01-01', dateTo: '2025-03-01' },
    status: ReportStatus.QUEUED,
    fileKey: null,
    fileUrl: null,
    expiresAt: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ReportJob);

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(ReportJob), useValue: mockRepo },
        { provide: getQueueToken(REPORT_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates job in queued status and enqueues generate-report', async () => {
      const job = makeJob();
      mockRepo.create.mockReturnValue(job);
      mockRepo.save.mockResolvedValue(job);

      const result = await service.create('user-uuid-1', {
        type: ReportType.USER_TRANSACTIONS,
        params: { dateFrom: '2025-01-01', dateTo: '2025-03-01' },
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReportStatus.QUEUED }),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        GENERATE_REPORT_JOB,
        { jobId: job.id },
        expect.any(Object),
      );
      expect(result.status).toBe(ReportStatus.QUEUED);
    });

    it('throws 400 when date range exceeds 90 days', async () => {
      await expect(
        service.create('user-uuid-1', {
          type: ReportType.USER_TRANSACTIONS,
          params: { dateFrom: '2025-01-01', dateTo: '2025-06-01' },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('throws 400 when dateFrom is after dateTo', async () => {
      await expect(
        service.create('user-uuid-1', {
          type: ReportType.USER_TRANSACTIONS,
          params: { dateFrom: '2025-03-01', dateTo: '2025-01-01' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates job without params (no date range validation)', async () => {
      const job = makeJob({ params: {} });
      mockRepo.create.mockReturnValue(job);
      mockRepo.save.mockResolvedValue(job);

      const result = await service.create('user-uuid-1', {
        type: ReportType.WAITLIST_EXPORT,
      });

      expect(result.status).toBe(ReportStatus.QUEUED);
      expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('requestGdprExport', () => {
    it('enforces one GDPR export per 30 days', async () => {
      mockRepo.count.mockResolvedValue(1);

      await expect(service.requestGdprExport('user-uuid-1')).rejects.toThrow(
        BadRequestException,
      );

      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('requestAccountStatement', () => {
    it('rejects ranges longer than 12 months', async () => {
      await expect(
        service.requestAccountStatement('user-uuid-1', '2025-01-01', '2026-12-01'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getForUser ────────────────────────────────────────────────────────────

  describe('getForUser', () => {
    it('returns job when it belongs to the user', async () => {
      mockRepo.findOne.mockResolvedValue(makeJob());

      const result = await service.getForUser('user-uuid-1', 'report-uuid-1');
      expect(result.id).toBe('report-uuid-1');
    });

    it('throws 404 when job not found or belongs to another user', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getForUser('user-uuid-1', 'bad-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteExpired ─────────────────────────────────────────────────────────

  describe('deleteExpired', () => {
    it('returns expired jobs for R2 cleanup', async () => {
      const expired = [
        makeJob({ id: 'r1', fileKey: 'reports/u1/r1.csv', status: ReportStatus.READY }),
        makeJob({ id: 'r2', fileKey: null, status: ReportStatus.READY }),
      ];
      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(expired),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);
      mockRepo.remove.mockResolvedValue(undefined);

      const result = await service.deleteExpired();

      expect(result).toHaveLength(2);
      expect(mockRepo.remove).toHaveBeenCalledWith(expired);
    });

    it('returns empty array when nothing is expired', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.deleteExpired();
      expect(result).toHaveLength(0);
      expect(mockRepo.remove).not.toHaveBeenCalled();
    });
  });
});
