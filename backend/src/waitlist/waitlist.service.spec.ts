import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  TooManyRequestsException,
} from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { WaitlistEntry } from './entities/waitlist-entry.entity';
import { EmailService } from '../email/email.service';
import { CheeseGateway } from '../ws/cheese.gateway';
import { REDIS_CLIENT } from '../cache/redis.module';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  increment: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
  zadd: jest.fn(),
  unlink: jest.fn(),
  get: jest.fn(),
  setex: jest.fn(),
  zrevrangebyscore: jest.fn(),
};

const mockEmail = { queue: jest.fn() };
const mockGateway = { server: { emit: jest.fn() } };

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeEntry = (overrides: Partial<WaitlistEntry> = {}): WaitlistEntry =>
  ({
    id: 'entry-uuid-1',
    email: 'alice@example.com',
    name: 'Alice',
    referralCode: 'abc12345',
    referredByCode: null,
    points: 100,
    ipAddress: '1.2.3.4',
    fingerprint: null,
    isFraudFlagged: false,
    joinedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as WaitlistEntry);

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('WaitlistService', () => {
  let service: WaitlistService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default happy-path redis: first signup from this IP
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.zadd.mockResolvedValue(1);
    mockRedis.unlink.mockResolvedValue(1);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.zrevrangebyscore.mockResolvedValue([]);
    mockEmail.queue.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        { provide: getRepositoryToken(WaitlistEntry), useValue: mockRepo },
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: EmailService, useValue: mockEmail },
        { provide: CheeseGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
  });

  // ── join ──────────────────────────────────────────────────────────────────

  describe('join', () => {
    it('awards 100 base points on successful join', async () => {
      mockRepo.findOne.mockResolvedValue(null); // no duplicate, no referrer
      const saved = makeEntry();
      mockRepo.create.mockReturnValue(saved);
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.join(
        { email: 'alice@example.com', name: 'Alice' },
        '1.2.3.4',
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ points: 100 }),
      );
      expect(result.points).toBe(100);
    });

    it('awards 50 bonus points to referrer on valid referral', async () => {
      const referrer = makeEntry({ id: 'ref-uuid', referralCode: 'ref00001', points: 100 });

      mockRepo.findOne
        .mockResolvedValueOnce(null)       // no duplicate email
        .mockResolvedValueOnce(referrer)   // referrer found
        .mockResolvedValueOnce(null);      // referral code uniqueness check

      const newEntry = makeEntry({ email: 'bob@example.com', referredByCode: 'ref00001' });
      mockRepo.create.mockReturnValue(newEntry);
      mockRepo.save.mockResolvedValue(newEntry);
      mockRepo.increment.mockResolvedValue(undefined);

      await service.join(
        { email: 'bob@example.com', name: 'Bob', referredByCode: 'ref00001' },
        '5.6.7.8',
      );

      expect(mockRepo.increment).toHaveBeenCalledWith(
        { id: 'ref-uuid' }, 'points', 50,
      );
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'waitlist:leaderboard', 150, 'ref00001',
      );
    });

    it('throws 409 on duplicate email', async () => {
      mockRepo.findOne.mockResolvedValue(makeEntry()); // existing entry

      await expect(
        service.join({ email: 'alice@example.com', name: 'Alice' }, '1.2.3.4'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 429 on 4th submission from same IP', async () => {
      mockRedis.incr.mockResolvedValue(4); // over the limit
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.join({ email: 'new@example.com', name: 'New' }, '1.2.3.4'),
      ).rejects.toThrow(TooManyRequestsException);
    });

    it('throws 400 for disposable email domain', async () => {
      await expect(
        service.join({ email: 'test@mailinator.com', name: 'Test' }, '1.2.3.4'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 400 for invalid referral code', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce(null)   // no duplicate email
        .mockResolvedValueOnce(null);  // referrer not found

      await expect(
        service.join(
          { email: 'bob@example.com', name: 'Bob', referredByCode: 'badcode' },
          '1.2.3.4',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getRank ───────────────────────────────────────────────────────────────

  describe('getRank', () => {
    it('returns rank, points, referralCode, referralLink, totalEntries', async () => {
      const entry = makeEntry({ points: 150 });
      mockRepo.findOne.mockResolvedValue(entry);
      mockRepo.count.mockResolvedValue(42);

      const qb = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getRank('alice@example.com');

      expect(result.rank).toBe(6); // 5 above + 1
      expect(result.points).toBe(150);
      expect(result.totalEntries).toBe(42);
      expect(result.referralLink).toContain('abc12345');
    });

    it('throws 404 when email not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.getRank('ghost@example.com')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
