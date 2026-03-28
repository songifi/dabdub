import { Test, TestingModule } from '@nestjs/testing';
import { SessionsService } from './sessions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Session } from './session.entity';
import { RedisService } from 'nestjs-redis';
import { Repository } from 'typeorm';

const mockSessionRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  findOne: jest.fn(),
});

const mockRedisService = () => ({
  getClient: jest.fn(() => ({
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  })),
});

describe('SessionsService', () => {
  let service: SessionsService;
  let sessionRepository: Repository<Session>;
  let redisClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getRepositoryToken(Session), useFactory: mockSessionRepository },
        { provide: RedisService, useFactory: mockRedisService },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    sessionRepository = module.get<Repository<Session>>(getRepositoryToken(Session));
    redisClient = module.get<RedisService>(RedisService).getClient();
  });

  it('should create a session', async () => {
    const session = { id: '1', userId: 'user1', deviceInfo: {}, ipAddress: '127.0.0.1' };
    sessionRepository.create.mockReturnValue(session);
    sessionRepository.save.mockResolvedValue(session);

    const result = await service.create('user1', {}, '127.0.0.1');
    expect(result).toEqual('1');
    expect(sessionRepository.create).toHaveBeenCalledWith({
      userId: 'user1',
      deviceInfo: {},
      ipAddress: '127.0.0.1',
      lastActiveAt: expect.any(Date),
    });
    expect(sessionRepository.save).toHaveBeenCalledWith(session);
  });

  it('should revoke a session', async () => {
    const session = { id: '1', userId: 'user1', revokedAt: null };
    sessionRepository.findOne.mockResolvedValue(session);

    await service.revoke('1', 'user1');
    expect(session.revokedAt).toBeDefined();
    expect(sessionRepository.save).toHaveBeenCalledWith(session);
  });

  it('should get all non-revoked sessions', async () => {
    const sessions = [
      { id: '1', userId: 'user1', revokedAt: null },
      { id: '2', userId: 'user1', revokedAt: null },
    ];
    sessionRepository.find.mockResolvedValue(sessions);

    const result = await service.getAllSessions('user1');
    expect(result).toEqual(sessions);
    expect(sessionRepository.find).toHaveBeenCalledWith({ where: { userId: 'user1', revokedAt: expect.any(Object) } });
  });
});