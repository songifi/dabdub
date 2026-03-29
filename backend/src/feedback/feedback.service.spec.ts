import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { FeedbackType } from './entities/feedback.entity';
import { TransactionStatus } from '../transactions/entities/transaction.entity';
import { FraudStatus } from '../fraud/entities/fraud-flag.entity';
import { FeedbackPromptTrigger } from './dto/should-prompt-query.dto';

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

  const activeUser = {
    id: 'user-1',
    isActive: true,
    createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');
    userRepo.findOne.mockResolvedValue(activeUser);
    fraudRepo.count.mockResolvedValue(0);
    txRepo.count.mockResolvedValue(5);

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

  describe('shouldPrompt', () => {
    it('respects 7-day cooldown — returns false when Redis key exists', async () => {
      const service = createService();
      redis.get.mockResolvedValue('1');

      const result = await service.shouldPrompt('user-1', FeedbackPromptTrigger.TRANSACTION_RATING);

      expect(result).toEqual({ shouldPrompt: false, reason: 'cooldown_active' });
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('sets Redis key with 604800s TTL when prompt is shown', async () => {
      const service = createService();

      await service.shouldPrompt('user-1', FeedbackPromptTrigger.TRANSACTION_RATING);

      expect(redis.set).toHaveBeenCalledWith(
        `feedback:prompted:user-1:transaction_rating`,
        '1',
        'EX',
        604800,
      );
    });

    it('transaction_rating requires 3 completed transactions', async () => {
      const service = createService();
      txRepo.count.mockResolvedValue(2);

      const result = await service.shouldPrompt('user-1', FeedbackPromptTrigger.TRANSACTION_RATING);

      expect(result).toEqual({ shouldPrompt: false, reason: 'requires_three_transactions' });
    });

    it('transaction_rating returns true when user has >= 3 completed transactions', async () => {
      const service = createService();
      txRepo.count.mockResolvedValue(3);

      const result = await service.shouldPrompt('user-1', FeedbackPromptTrigger.TRANSACTION_RATING);

      expect(result.shouldPrompt).toBe(true);
    });

    it('NPS requires 30 days of active use', async () => {
      const service = createService();
      userRepo.findOne.mockResolvedValue({
        ...activeUser,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // only 10 days ago
      });

      const result = await service.shouldPrompt('user-1', FeedbackPromptTrigger.NPS);

      expect(result).toEqual({ shouldPrompt: false, reason: 'requires_30_days_active_use' });
    });

    it('NPS returns true when user account is >= 30 days old', async () => {
      const service = createService();

      const result = await service.shouldPrompt('user-1', FeedbackPromptTrigger.NPS);

      expect(result.shouldPrompt).toBe(true);
    });

    it('blocks prompt when account has open fraud restrictions', async () => {
      const service = createService();
      fraudRepo.count.mockResolvedValue(1);

      const result = await service.shouldPrompt('user-1', FeedbackPromptTrigger.GENERAL);

      expect(fraudRepo.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: FraudStatus.OPEN },
      });
      expect(result).toEqual({ shouldPrompt: false, reason: 'account_restricted' });
    });

    it('blocks prompt for inactive account', async () => {
      const service = createService();
      userRepo.findOne.mockResolvedValue({ ...activeUser, isActive: false });

      const result = await service.shouldPrompt('user-1', FeedbackPromptTrigger.GENERAL);

      expect(result).toEqual({ shouldPrompt: false, reason: 'account_inactive' });
    });
  });

  describe('submit', () => {
    it('rating <= 2 auto-creates SupportTicket', async () => {
      const service = createService();

      const result = await service.submit('user-1', {
        type: FeedbackType.TRANSACTION_RATING,
        rating: 2,
        message: 'Transfer flow failed',
      });

      expect(result.feedback.requiresOutreach).toBe(true);
      expect(supportTicketRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', feedbackId: 'feedback-1' }),
      );
      expect(result.supportTicket?.id).toBe('ticket-1');
    });

    it('rating > 2 does not create SupportTicket', async () => {
      const service = createService();

      const result = await service.submit('user-1', {
        type: FeedbackType.TRANSACTION_RATING,
        rating: 4,
      });

      expect(result.supportTicket).toBeNull();
      expect(supportTicketRepo.save).not.toHaveBeenCalled();
    });

    it('NPS detractor (score <= 6) flagged for outreach, no support ticket', async () => {
      const service = createService();

      const result = await service.submit('user-1', {
        type: FeedbackType.NPS,
        npsScore: 6,
        message: 'Need faster settlements',
      });

      expect(result.feedback.requiresOutreach).toBe(true);
      expect(result.supportTicket).toBeNull();
    });

    it('NPS promoter (score >= 9) not flagged for outreach', async () => {
      const service = createService();

      const result = await service.submit('user-1', {
        type: FeedbackType.NPS,
        npsScore: 9,
      });

      expect(result.feedback.requiresOutreach).toBe(false);
    });

    it('rejects non-NPS payload without rating', async () => {
      const service = createService();

      await expect(
        service.submit('user-1', { type: FeedbackType.BUG_REPORT }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects NPS payload without npsScore', async () => {
      const service = createService();

      await expect(
        service.submit('user-1', { type: FeedbackType.NPS }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAggregates', () => {
    it('computes NPS correctly: % promoters - % detractors', async () => {
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
          { score: '10' }, // promoter
          { score: '9' },  // promoter
          { score: '8' },  // passive
          { score: '6' },  // detractor
        ]),
      };

      const distQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ rating: '4', count: '3' }]),
      };

      const commentsQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ message: 'Great app' }]),
      };

      feedbackRepo.createQueryBuilder
        .mockReturnValueOnce(ratingQb as any)
        .mockReturnValueOnce(npsQb as any)
        .mockReturnValueOnce(distQb as any)
        .mockReturnValueOnce(commentsQb as any);

      feedbackRepo.count.mockResolvedValue(10);

      const result = await service.getAggregates();

      // promoters=2, detractors=1, total=4 → nps = round((2-1)/4 * 100) = 25
      expect(result.npsScore).toBe(25);
      expect(result.totalFeedback).toBe(10);
      expect(result.recentComments).toEqual(['Great app']);
    });
  });
});
