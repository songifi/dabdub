import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { EmailService, EMAIL_QUEUE, EmailJobPayload } from './email.service';
import { EmailProcessor } from './email.processor';
import { ZeptoMailService } from './zepto-mail.service';
import { EmailLog, EmailStatus } from './entities/email-log.entity';
import { Job } from 'bull';

const mockLog: EmailLog = {
  id: 'log-1',
  to: 'user@example.com',
  templateAlias: 'welcome',
  subject: 'welcome',
  status: EmailStatus.QUEUED,
  userId: null,
  providerMessageId: null,
  errorMessage: null,
  attemptCount: 0,
  sentAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRepo = {
  create: jest.fn().mockReturnValue(mockLog),
  save: jest.fn().mockResolvedValue(mockLog),
  update: jest.fn().mockResolvedValue(undefined),
};

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

const mockZepto = {
  send: jest.fn(),
};

function makeJob(
  overrides: Partial<{ attemptsMade: number; opts: { attempts: number } }> = {},
): Job<EmailJobPayload> {
  return {
    data: {
      logId: 'log-1',
      to: 'user@example.com',
      templateAlias: 'welcome',
      mergeData: {},
    },
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...overrides,
  } as unknown as Job<EmailJobPayload>;
}

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: getRepositoryToken(EmailLog), useValue: mockRepo },
        { provide: getQueueToken(EMAIL_QUEUE), useValue: mockQueue },
      ],
    }).compile();
    service = module.get(EmailService);
  });

  it('queue() creates log with QUEUED status and enqueues job', async () => {
    const log = await service.queue('user@example.com', 'welcome', { name: 'Alice' }, 'user-1');

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: EmailStatus.QUEUED, to: 'user@example.com' }),
    );
    expect(mockRepo.save).toHaveBeenCalled();
    expect(mockQueue.add).toHaveBeenCalledWith(
      expect.objectContaining({ logId: 'log-1', templateAlias: 'welcome' }),
      expect.objectContaining({ attempts: 3 }),
    );
    expect(log.status).toBe(EmailStatus.QUEUED);
  });
});

describe('EmailProcessor', () => {
  let processor: EmailProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        { provide: getRepositoryToken(EmailLog), useValue: mockRepo },
        { provide: ZeptoMailService, useValue: mockZepto },
        { provide: EmailService, useValue: { getBackoffDelay: jest.fn() } },
      ],
    }).compile();
    processor = module.get(EmailProcessor);
  });

  it('successful send → updates log to SENT with messageId', async () => {
    mockZepto.send.mockResolvedValue({ messageId: 'msg-abc' });

    await processor.handleSend(makeJob());

    expect(mockZepto.send).toHaveBeenCalledWith('user@example.com', 'welcome', {});
    expect(mockRepo.update).toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({ status: EmailStatus.SENT, providerMessageId: 'msg-abc' }),
    );
  });

  it('ZeptoMail error → throws so Bull retries', async () => {
    mockZepto.send.mockRejectedValue(new Error('ZeptoMail 500: Internal Server Error'));

    await expect(processor.handleSend(makeJob())).rejects.toThrow('ZeptoMail 500');
  });

  it('3 retries exhausted → handleFailed sets status=FAILED', async () => {
    const job = makeJob({ attemptsMade: 3, opts: { attempts: 3 } });
    const err = new Error('ZeptoMail 500: Internal Server Error');

    await processor.handleFailed(job, err);

    expect(mockRepo.update).toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({
        status: EmailStatus.FAILED,
        errorMessage: 'ZeptoMail 500: Internal Server Error',
      }),
    );
  });

  it('non-exhausted failure → does NOT set status=FAILED', async () => {
    const job = makeJob({ attemptsMade: 1, opts: { attempts: 3 } });

    await processor.handleFailed(job, new Error('timeout'));

    expect(mockRepo.update).not.toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({ status: EmailStatus.FAILED }),
    );
  });
});
