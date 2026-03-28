import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ReportsProcessor } from './reports.processor';
import { ReportsService } from './reports.service';
import { ReportJob, ReportStatus, ReportType } from './entities/report-job.entity';
import { EmailService } from '../email/email.service';
import { r2Config } from '../config/r2.config';

// ── Module-level mocks ────────────────────────────────────────────────────────

const mockSend = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://r2.example.com/reports/presigned'),
}));

jest.mock('./report-generator', () => ({
  generateCsv: jest.fn().mockResolvedValue(Buffer.from('id,type\n1,deposit\n')),
}));

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockReportsService = {
  findById: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
  deleteExpired: jest.fn().mockResolvedValue([]),
};

const mockEmailService = {
  queue: jest.fn().mockResolvedValue({}),
};

const mockUserRepo = {
  findOne: jest.fn().mockResolvedValue({ id: 'user-uuid-1', email: 'user@example.com' }),
};

const mockDataSource = {
  query: jest.fn().mockResolvedValue([]),
  getRepository: jest.fn().mockReturnValue(mockUserRepo),
};

const mockR2Config = {
  accountId: 'test-account',
  accessKeyId: 'key',
  secretAccessKey: 'secret',
  bucketName: 'test-bucket',
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

const makeBullJob = (data: object) =>
  ({
    data,
    attemptsMade: 0,
    opts: { attempts: 3 },
  }) as any;

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ReportsProcessor', () => {
  let processor: ReportsProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsProcessor,
        { provide: ReportsService, useValue: mockReportsService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: r2Config.KEY, useValue: mockR2Config },
      ],
    }).compile();

    processor = module.get<ReportsProcessor>(ReportsProcessor);
  });

  // ── handleGenerate ────────────────────────────────────────────────────────

  describe('handleGenerate', () => {
    it('sets processing then ready, uploads to R2, generates presigned URL', async () => {
      const reportJob = makeJob();
      mockReportsService.findById.mockResolvedValue(reportJob);

      await processor.handleGenerate(makeBullJob({ jobId: 'report-uuid-1' }));

      // First update: processing
      expect(mockReportsService.update).toHaveBeenNthCalledWith(1, 'report-uuid-1', {
        status: ReportStatus.PROCESSING,
      });

      // S3 PutObject called
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Second update: ready with presigned URL
      expect(mockReportsService.update).toHaveBeenNthCalledWith(2, 'report-uuid-1',
        expect.objectContaining({
          status: ReportStatus.READY,
          fileKey: expect.stringContaining('report-uuid-1'),
          fileUrl: 'https://r2.example.com/reports/presigned',
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('fileUrl is a presigned URL (not a plain R2 key)', async () => {
      mockReportsService.findById.mockResolvedValue(makeJob());

      await processor.handleGenerate(makeBullJob({ jobId: 'report-uuid-1' }));

      const secondCall = mockReportsService.update.mock.calls[1];
      expect(secondCall[1].fileUrl).toMatch(/^https:\/\//);
    });

    it('uses 48-hour expiry for GDPR export download links', async () => {
      const reportJob = makeJob({
        type: ReportType.GDPR_EXPORT,
        params: {},
      });
      mockReportsService.findById.mockResolvedValue(reportJob);
      jest
        .spyOn(processor as any, 'generateGdprZip')
        .mockResolvedValue(Buffer.from('zip'));

      await processor.handleGenerate(makeBullJob({ jobId: reportJob.id }));

      const secondCall = mockReportsService.update.mock.calls[1];
      const expiresAt = secondCall[1].expiresAt as Date;
      const hours = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
      expect(hours).toBeGreaterThanOrEqual(47);
      expect(hours).toBeLessThanOrEqual(48);
    });

    it('skips gracefully when job not found', async () => {
      mockReportsService.findById.mockResolvedValue(null);

      await processor.handleGenerate(makeBullJob({ jobId: 'missing-id' }));

      expect(mockReportsService.update).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  // ── handleCleanup ─────────────────────────────────────────────────────────

  describe('handleCleanup', () => {
    it('deletes R2 objects for expired jobs with fileKey', async () => {
      const expired = [
        makeJob({ id: 'r1', fileKey: 'reports/u1/r1.csv' }),
        makeJob({ id: 'r2', fileKey: null }),
      ];
      mockReportsService.deleteExpired.mockResolvedValue(expired);

      await processor.handleCleanup(makeBullJob({}));

      // Only the job with a fileKey triggers a DeleteObject
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('handles R2 delete failure gracefully without throwing', async () => {
      mockReportsService.deleteExpired.mockResolvedValue([
        makeJob({ fileKey: 'reports/u1/r1.csv' }),
      ]);
      mockSend.mockRejectedValueOnce(new Error('R2 error'));

      await expect(processor.handleCleanup(makeBullJob({}))).resolves.not.toThrow();
    });
  });

  // ── handleFailed ──────────────────────────────────────────────────────────

  describe('handleFailed', () => {
    it('marks job as failed when all attempts exhausted', async () => {
      const bullJob = { data: { jobId: 'report-uuid-1' }, attemptsMade: 3, opts: { attempts: 3 } } as any;

      await processor.handleFailed(bullJob, new Error('DB timeout'));

      expect(mockReportsService.update).toHaveBeenCalledWith('report-uuid-1', {
        status: ReportStatus.FAILED,
        errorMessage: 'DB timeout',
      });
    });

    it('does not mark failed when attempts remain', async () => {
      const bullJob = { data: { jobId: 'report-uuid-1' }, attemptsMade: 1, opts: { attempts: 3 } } as any;

      await processor.handleFailed(bullJob, new Error('transient'));

      expect(mockReportsService.update).not.toHaveBeenCalled();
    });
  });
});
