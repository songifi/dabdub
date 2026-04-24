import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { NotificationService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { redisConfig } from '../config/redis.config';
import { CheeseGateway } from '../ws/cheese.gateway';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

describe('NotificationService', () => {
  let service: NotificationService;
  let repo: jest.Mocked<
    Pick<
      Repository<Notification>,
      'create' | 'save' | 'count' | 'findOne' | 'createQueryBuilder'
    >
  >;

  const gateway = { emitToUser: jest.fn().mockResolvedValue(undefined) };
  const mockRedisConfig = {
    host: 'localhost',
    port: 6379,
    password: undefined,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    repo = {
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: repo },
        { provide: CheeseGateway, useValue: gateway },
        { provide: redisConfig.KEY, useValue: mockRedisConfig },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  it('create → invalidates unread count and emits websocket', async () => {
    repo.create.mockReturnValue({ userId: 'u1' } as Notification);
    repo.save.mockResolvedValue({ id: 'n1', userId: 'u1' } as Notification);

    await service.create('u1', 'system', 't', 'b', { a: 1 });

    expect(mockRedis.del).toHaveBeenCalledWith('notifications:unread-count:u1');
    expect(gateway.emitToUser).toHaveBeenCalledWith(
      'u1',
      'notification_new',
      expect.objectContaining({ id: 'n1' }),
    );
  });

  it('getUnreadCount caches count for 30s and returns cached value', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    repo.count.mockResolvedValueOnce(3);

    const first = await service.getUnreadCount('u1');
    expect(first).toBe(3);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'notifications:unread-count:u1',
      '3',
      'EX',
      30,
    );

    mockRedis.get.mockResolvedValueOnce('3');
    const second = await service.getUnreadCount('u1');
    expect(second).toBe(3);
    expect(repo.count).toHaveBeenCalledTimes(1);
  });

  it('markRead invalidates cache; unread count decrements', async () => {
    repo.findOne.mockResolvedValueOnce({
      id: 'n1',
      userId: 'u1',
      isRead: false,
      readAt: null,
    } as Notification);
    repo.save.mockResolvedValueOnce({} as Notification);

    await service.markRead('u1', 'n1');
    expect(mockRedis.del).toHaveBeenCalledWith('notifications:unread-count:u1');

    // Simulate DB counts before/after read.
    mockRedis.get.mockResolvedValueOnce(null);
    repo.count.mockResolvedValueOnce(2);
    const count = await service.getUnreadCount('u1');
    expect(count).toBe(2);
  });

  it('markAllRead invalidates cache; unread count becomes 0', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 5 });
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute,
    };
    repo.createQueryBuilder.mockReturnValue(qb as any);

    await service.markAllRead('u1');
    expect(mockRedis.del).toHaveBeenCalledWith('notifications:unread-count:u1');

    mockRedis.get.mockResolvedValueOnce(null);
    repo.count.mockResolvedValueOnce(0);
    const count = await service.getUnreadCount('u1');
    expect(count).toBe(0);
  });

  it('listForUser returns paginated results and encodes nextCursor', async () => {
    const now = new Date();
    const rows = Array.from({ length: 3 }, (_, idx) => ({
      id: `n${idx + 1}`,
      userId: 'u1',
      createdAt: new Date(now.getTime() - idx * 1000),
    })) as Notification[];
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    repo.createQueryBuilder.mockReturnValue(qb as any);

    const result = await service.listForUser('u1', { limit: 2 });

    expect(qb.take).toHaveBeenCalledWith(3);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBeDefined();
  });

  it('listForUser throws when cursor is invalid', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    repo.createQueryBuilder.mockReturnValue(qb as any);

    await expect(
      service.listForUser('u1', { cursor: 'invalid-cursor', limit: 2 }),
    ).rejects.toThrow('Invalid cursor');
  });

  it('markRead with already read notification does not re-save record but invalidates cache', async () => {
    repo.findOne.mockResolvedValueOnce({
      id: 'n1',
      userId: 'u1',
      isRead: true,
      readAt: new Date(),
    } as Notification);

    await service.markRead('u1', 'n1');
    expect(repo.save).not.toHaveBeenCalled();
    expect(mockRedis.del).toHaveBeenCalledWith('notifications:unread-count:u1');
  });

  it('getUnreadCount returns 0 for invalid cached values', async () => {
    mockRedis.get.mockResolvedValueOnce('not-a-number');
    const result = await service.getUnreadCount('u1');
    expect(result).toBe(0);
  });

  it('broadcast logs the broadcast payload', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await service.broadcast('Title', 'Body', 'segment-a');
    expect(spy).toHaveBeenCalledWith(
      '[BROADCAST] Segment: segment-a, Title: Title, Body: Body',
    );
    spy.mockRestore();
  });
});
