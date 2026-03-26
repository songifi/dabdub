import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SmsProcessor } from '../sms.processor';
import { SmsLog, SmsStatus } from '../entities/sms-log.entity';
import { TermiiService } from '../termii.service';

const mockRepo = () => ({
  update: jest.fn(),
});

const mockTermii = () => ({
  send: jest.fn(),
});

describe('SmsProcessor', () => {
  let processor: SmsProcessor;
  let termii: ReturnType<typeof mockTermii>;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsProcessor,
        { provide: getRepositoryToken(SmsLog), useFactory: mockRepo },
        { provide: TermiiService, useFactory: mockTermii },
      ],
    }).compile();

    processor = module.get(SmsProcessor);
    termii = module.get(TermiiService);
    repo = module.get(getRepositoryToken(SmsLog));
  });

  it('should mark log as SENT on success', async () => {
    termii.send.mockResolvedValue({ messageId: 'ref-123' });
    repo.update.mockResolvedValue({});

    await processor.handleSend({ data: { logId: 'log-1', phone: '+2348012345678', message: 'test' } } as any);

    expect(repo.update).toHaveBeenCalledWith('log-1', expect.objectContaining({
      status: SmsStatus.SENT,
      providerRef: 'ref-123',
    }));
  });

  it('should mark log as FAILED after exhausted retries', async () => {
    const err = new Error('Termii 500: Internal Server Error');
    repo.update.mockResolvedValue({});

    await processor.handleFailed(
      { data: { logId: 'log-2' }, attemptsMade: 3, opts: { attempts: 3 } } as any,
      err,
    );

    expect(repo.update).toHaveBeenCalledWith('log-2', expect.objectContaining({
      status: SmsStatus.FAILED,
      errorMessage: err.message,
    }));
  });

  it('should NOT mark as FAILED if retries not yet exhausted', async () => {
    const err = new Error('Termii 500: Internal Server Error');

    await processor.handleFailed(
      { data: { logId: 'log-3' }, attemptsMade: 1, opts: { attempts: 3 } } as any,
      err,
    );

    expect(repo.update).not.toHaveBeenCalled();
  });
});
