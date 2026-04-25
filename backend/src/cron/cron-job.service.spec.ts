import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CronJobService } from './cron-job.service';
import { CronJobLog, CronJobStatus } from './entities/cron-job-log.entity';
import { RequestTimeoutException } from '@nestjs/common';

describe('CronJobService', () => {
  let service: CronJobService;
  let mockRepo: jest.Mocked<any>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CronJobService,
        {
          provide: getRepositoryToken(CronJobLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CronJobService>(CronJobService);
    mockRepo = module.get(getRepositoryToken(CronJobLog));
  });

  it('should log start and complete successfully', async () => {
    const mockFn = jest.fn().mockResolvedValue('result');
    mockRepo.create.mockReturnValue({ id: 'log1' });
    mockRepo.save.mockResolvedValue({ id: 'log1' } as any);

    const result = await service.run('test-job', mockFn, 42);

    expect(mockRepo.create).toHaveBeenCalledWith({
      jobName: 'test-job',
      status: CronJobStatus.STARTED,
    });
    expect(result).toBe('result');
    expect(mockRepo.save).toHaveBeenNthCalledWith(2, expect.objectContaining({
      status: CronJobStatus.COMPLETED,
      durationMs: expect.any(Number),
      itemsProcessed: 42,
    }));
  });

  it('should timeout when job exceeds deadline', async () => {
    const mockFn = jest.fn().mockReturnValue(new Promise(() => {}));
    mockRepo.create.mockReturnValue({ id: 'log1' });
    mockRepo.save.mockResolvedValue({} as any);

    const timeoutMs = 50;
    await expect(service.run('timeout-job', mockFn, undefined, timeoutMs)).rejects.toThrow(
      RequestTimeoutException,
    );
    expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: CronJobStatus.FAILED,
    }));
  });

  it('should log failure', async () => {
    const error = new Error('test error');
    const mockFn = jest.fn().mockRejectedValue(error);
    mockRepo.create.mockReturnValue({ id: 'log1' });
    mockRepo.save.mockResolvedValue({} as any);

    await expect(service.run('fail-job', mockFn)).rejects.toThrow('test error');

    expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      status: CronJobStatus.FAILED,
      errorMessage: 'test error',
    }));
  });
});

