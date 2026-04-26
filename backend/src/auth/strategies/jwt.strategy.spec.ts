import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { JwtService } from '@nestjs/jwt';
import { CacheService } from '../../cache/cache.service';
import { jwtConfig } from '../../config/jwt.config';
import { User } from '../../users/entities/user.entity';
import { Admin } from '../../admin/entities/admin.entity';

const mockUserRepo = {
  findOne: jest.fn(),
};

const mockAdminRepo = {
  findOne: jest.fn(),
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(true),
};

const mockJwtConfig = {
  accessSecret: 'access-secret-32-chars-minimum!!',
  refreshSecret: 'refresh-secret-32-chars-minimum!!',
  accessExpiry: '15m',
  refreshExpiry: '30d',
};

const mockJwtService = {
  sign: jest.fn(),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Admin), useValue: mockAdminRepo },
        { provide: CacheService, useValue: mockCacheService },
        { provide: jwtConfig.KEY, useValue: mockJwtConfig },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('returns the cached user when session cache exists', async () => {
    const cachedUser = { id: 'user-1', username: 'alice', role: 'user', isActive: true } as User;
    mockCacheService.get
      .mockResolvedValueOnce(false) // blacklist check
      .mockResolvedValueOnce(cachedUser); // session cache

    const result = await strategy.validate({
      sub: 'user-1',
      username: 'alice',
      role: 'user',
      sessionId: 'session-1',
      jti: 'session-1',
      exp: Math.floor(Date.now() / 1000) + 300,
    });

    expect(result).toBe(cachedUser);
    expect(mockUserRepo.findOne).not.toHaveBeenCalled();
  });

  it('caches the user after DB lookup when no cached session exists', async () => {
    const user = { id: 'user-1', username: 'alice', role: 'user', isActive: true } as User;
    mockCacheService.get.mockResolvedValueOnce(null);
    mockUserRepo.findOne.mockResolvedValueOnce(user);

    const payload = {
      sub: 'user-1',
      username: 'alice',
      role: 'user',
      sessionId: 'session-1',
      jti: 'session-1',
      exp: Math.floor(Date.now() / 1000) + 300,
    };

    const result = await strategy.validate(payload);

    expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { id: payload.sub } });
    expect(mockCacheService.set).toHaveBeenCalledWith(
      `session:${payload.jti}`,
      user,
      expect.any(Number),
    );
    expect(result).toMatchObject({ id: 'user-1' });
  });

  it('rejects a blacklisted session', async () => {
    mockCacheService.get.mockResolvedValueOnce(true);

    await expect(
      strategy.validate({
        sub: 'user-1',
        username: 'alice',
        role: 'user',
        sessionId: 'session-1',
        jti: 'session-1',
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    ).rejects.toThrow('Unauthorized');
  });
});
