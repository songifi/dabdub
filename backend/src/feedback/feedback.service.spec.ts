import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { FeedbackType } from './entities/feedback.entity';
import { TransactionStatus } from '../transactions/entities/transaction.entity';
import { FraudStatus } from '../fraud/entities/fraud-flag.entity';

describe('FeedbackService', () => {
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const feedbackRepo = {
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const supportTicketRepo = {
    save: jest.fn(),
    create: jest.fn(),
  };

  const txRepo = {
    count: jest.fn(),
  };

  const userRepo = {
    findOne: jest.fn(),
  };

  const fraudRepo = {
    count: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');

    userRepo.findOne.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      updatedAt: new Date(),
    });
    fraudRepo.count.mockResolvedValue(0);

    feedbackRepo.create.mockImplementation((payload: any) => payload);
    feedbackRepo.save.mockImplementation(async (payload: any) => ({
      id: 'feedback-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...payload,
    }));

    supportTicketRepo.create.mockImplementation((payload: any) => payload);
    supportTicketRepo.save.mockImplementation(async (payload: any) => ({
      id: 'ticket-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...payload,
    }));
  });

  function createService(): FeedbackService {
    return new FeedbackService(
      redis as any,
      feedbackRepo as any,
      supportTicketRepo as any,
      txRepo as any,
      userRepo as any,
      fraudRepo as any,
    );
  }

  it('returns false during cooldown', async () => {
    const service = createService();
    redis.get.mockResolvedValue('1');

    const result = await service.shouldPrompt('user-1', 'transaction_rating' as any);

    expect(result).toEqual({ shouldPrompt: false, reason: 'cooldown_active' });
  });

  it('requires third completed transaction for transaction rating prompt', async () => {
    const service = createService();

    txRepo.count
      .mockResolvedValueOnce(1) // recent completed tx count
      .mockResolvedValueOnce(2); // total completed tx count

    const result = await service.shouldPrompt('user-1', 'transaction_rating' as any);

    expect(txRepo.count).toHaveBeenNthCalledWith(1, {
      where: {
        userId: 'user-1',
        status: TransactionStatus.COMPLETED,
        createdAt: expect.anything(),
      },
    });
    expect(result).toEqual({
      shouldPrompt: false,
      reason: 'requires_three_transactions',
    });
  });

  it('creates support ticket automatically for low rating', async () => {
    const service = createService();

    const result = await service.submit('user-1', {
      type: FeedbackType.FEATURE_FEEDBACK,
      rating: 2,
      message: 'Transfer flow failed for me',
    });

    expect(result.feedback.requiresOutreach).toBe(true);
    expect(supportTicketRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        feedbackId: 'feedback-1',
      }),
    );
    expect(result.supportTicket?.id).toBe('ticket-1');
  });

  it('marks NPS detractor for outreach', async () => {
    const service = createService();

    const result = await service.submit('user-1', {
      type: FeedbackType.NPS,
      npsScore: 6,
      message: 'Need faster settlements',
    });

    expect(result.feedback.requiresOutreach).toBe(true);
    expect(result.supportTicket).toBeNull();
  });

  it('computes NPS formula correctly', async () => {
    const service = createService();

    const ratingQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ avgRating: '4.2' }),
    };

    const npsQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { score: '10' },
        { score: '9' },
        { score: '8' },
        { score: '6' },
      ]),
    };

    const typeQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { type: 'nps', count: '4' },
      ]),
    };

    feedbackRepo.createQueryBuilder
      .mockReturnValueOnce(ratingQb as any)
      .mockReturnValueOnce(npsQb as any)
      .mockReturnValueOnce(typeQb as any);

    feedbackRepo.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3); // outreach required count

    const result = await service.getAggregates();

    // promoters=2, detractors=1, total=4 -> nps=25
    expect(result.nps).toBe(25);
    expect(result.promoters).toBe(2);
    expect(result.detractors).toBe(1);
    expect(result.passive).toBe(1);
  });

  it('rejects non-NPS payload without rating', async () => {
    const service = createService();

    await expect(
      service.submit('user-1', {
        type: FeedbackType.FEATURE_FEEDBACK,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks prompt when account has open restrictions', async () => {
    const service = createService();
    fraudRepo.count.mockResolvedValue(1);

    const result = await service.shouldPrompt('user-1', 'feature_feedback' as any);

    expect(fraudRepo.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: FraudStatus.OPEN,
      },
    });
    expect(result).toEqual({
      shouldPrompt: false,
      reason: 'account_restricted',
    });
  });
});
