import { Test, TestingModule } from '@nestjs/testing';
import { getRedisToken } from '@nestjs-modules/ioredis';
import { LeaderboardService } from './leaderboard.service';

const mockRedis = {
  zscore: jest.fn(),
  zadd: jest.fn(),
  zincrby: jest.fn(),
  zrevrank: jest.fn(),
  zrevrange: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: getRedisToken(), useValue: mockRedis },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  describe('upsertScore', () => {
    it('adds a new entry with NX when entity does not exist', async () => {
      mockRedis.zscore.mockResolvedValue(null);
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.zrevrank.mockResolvedValue(null); // not in top 100

      await service.upsertScore('user-1', 100, 'users');

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'leaderboard:users',
        'NX',
        100,
        'user-1',
      );
    });

    it('does not decrease an existing score (uses GT)', async () => {
      mockRedis.zscore.mockResolvedValue('200'); // existing score is 200
      mockRedis.zadd.mockResolvedValue(0);
      mockRedis.zrevrank.mockResolvedValue(null);

      await service.upsertScore('user-1', 50, 'users'); // 50 < 200, GT will not update

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'leaderboard:users',
        'GT',
        50,
        'user-1',
      );
      // The GT flag is passed — Redis itself enforces no-decrease; we verify the correct flag is used
    });

    it('updates score when new score is greater', async () => {
      mockRedis.zscore.mockResolvedValue('100');
      mockRedis.zadd.mockResolvedValue(0);
      mockRedis.zrevrank.mockResolvedValue(5); // in top 100
      mockRedis.del.mockResolvedValue(1);

      await service.upsertScore('user-1', 300, 'users');

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'leaderboard:users',
        'GT',
        300,
        'user-1',
      );
      expect(mockRedis.del).toHaveBeenCalledWith('leaderboard:users:top100');
    });
  });

  describe('getTopN', () => {
    it('returns entries in correct descending order with 1-indexed ranks', async () => {
      mockRedis.zrevrange.mockResolvedValue([
        'user-3',
        '300',
        'user-1',
        '200',
        'user-2',
        '100',
      ]);

      const result = await service.getTopN(3, 'users');

      expect(result).toEqual([
        { rank: 1, id: 'user-3', displayName: 'user-3', score: 300 },
        { rank: 2, id: 'user-1', displayName: 'user-1', score: 200 },
        { rank: 3, id: 'user-2', displayName: 'user-2', score: 100 },
      ]);
    });

    it('returns empty array when leaderboard is empty', async () => {
      mockRedis.zrevrange.mockResolvedValue([]);
      const result = await service.getTopN(10, 'waitlist');
      expect(result).toEqual([]);
    });
  });

  describe('getRank', () => {
    it('returns 1-indexed rank when entity is on the board', async () => {
      mockRedis.zrevrank.mockResolvedValue(0); // 0-indexed rank 0 → rank 1
      const rank = await service.getRank('user-1', 'users');
      expect(rank).toBe(1);
    });

    it('returns null when entity is not on the board', async () => {
      mockRedis.zrevrank.mockResolvedValue(null);
      const rank = await service.getRank('nobody', 'users');
      expect(rank).toBeNull();
    });
  });

  describe('incrementScore', () => {
    it('calls ZINCRBY and returns the new score as a number', async () => {
      mockRedis.zincrby.mockResolvedValue('350');
      mockRedis.zrevrank.mockResolvedValue(null);

      const result = await service.incrementScore('user-1', 50, 'users');

      expect(mockRedis.zincrby).toHaveBeenCalledWith(
        'leaderboard:users',
        50,
        'user-1',
      );
      expect(result).toBe(350);
    });
  });
});
