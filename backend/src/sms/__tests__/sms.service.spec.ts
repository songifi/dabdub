import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { SmsService, SMS_QUEUE, SMS_REDIS } from '../sms.service';
import { SmsLog, SmsStatus } from '../entities/sms-log.entity';
import { SmsRateLimitException } from '../sms-rate-limit.exception';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const mockQueue = () => ({
  add: jest.fn(),
});

const mockRedis = () => ({
  incr: jest.fn(),
  expire: jest.fn(),
});

describe('SmsService', () => {
  let service: SmsService;
  let redis: ReturnType<typeof mockRedis>;
  let repo: ReturnType<typeof mockRepo>;
  let queue: ReturnType<typeof mockQueue>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: getRepositoryToken(SmsLog), useFactory: mockRepo },
        { provide: getQueueToken(SMS_QUEUE), useFactory: mockQueue },
        { provide: SMS_REDIS, useFactory: mockRedis },
      ],
    }).compile();

    service = module.get(SmsService);
    redis = module.get(SMS_REDIS);
    repo = module.get(getRepositoryToken(SmsLog));
    queue = module.get(getQueueToken(SMS_QUEUE));
  });

  describe('rate limiting', () => {
    it('should throw SmsRateLimitException on the 6th SMS to same phone in 1h', async () => {
      const phone = '+2348012345678';
      redis.incr.mockResolvedValue(6); // simulates 6th call
      redis.expire.mockResolvedValue(1);

      await expect(service.queue(phone, 'test message')).rejects.toThrow(
        SmsRateLimitException,
      );
      expect(repo.save).not.toHaveBeenCalled();
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('should allow SMS when count is exactly 5', async () => {
      const phone = '+2348012345678';
      redis.incr.mockResolvedValue(5);
      redis.expire.mockResolvedValue(1);

      const fakeLog = {
        id: 'log-1',
        phone,
        status: SmsStatus.QUEUED,
      } as SmsLog;
      repo.create.mockReturnValue(fakeLog);
      repo.save.mockResolvedValue(fakeLog);
      queue.add.mockResolvedValue({});

      await expect(service.queue(phone, 'test message')).resolves.toEqual(
        fakeLog,
      );
    });
  });

  describe('sendOtp', () => {
    it('should format OTP message correctly', async () => {
      redis.incr.mockResolvedValue(1);
      redis.expire.mockResolvedValue(1);

      const fakeLog = { id: 'log-2' } as SmsLog;
      repo.create.mockReturnValue(fakeLog);
      repo.save.mockResolvedValue(fakeLog);
      queue.add.mockResolvedValue({});

      await service.sendOtp('+2348012345678', '123456');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message:
            'Your Cheese verification code is 123456. Do not share it. Expires in 10 minutes.',
        }),
      );
    });
  });
});
