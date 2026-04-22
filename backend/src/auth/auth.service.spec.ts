import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Session } from './entities/session.entity';
import { jwtConfig } from '../config/jwt.config';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockTokenRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockSessionRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
};

const mockJwtConfig = {
  accessSecret: 'access-secret-32-chars-minimum!!',
  refreshSecret: 'refresh-secret-32-chars-minimum!!',
  accessExpiry: '15m',
  refreshExpiry: '30d',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid-1',
    email: 'alice@example.com',
    username: 'alice',
    passwordHash: '$2b$12$hashedpassword',
    isAdmin: false,
    isActive: true,
    isTreasury: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User);

const makeRefreshToken = (overrides: Partial<RefreshToken> = {}): RefreshToken =>
  ({
    id: 'rt-uuid-1',
    userId: 'user-uuid-1',
    tokenHash: 'a'.repeat(64),
    sessionId: 'session-uuid-1',
    deviceInfo: null,
    ipAddress: null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as RefreshToken);

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: mockTokenRepo },
        { provide: getRepositoryToken(Session), useValue: mockSessionRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: jwtConfig.KEY, useValue: mockJwtConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── register ───────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates a user and returns a token pair', async () => {
      mockUserRepo.findOne.mockResolvedValue(null); // no existing email/username
      const user = makeUser();
      mockUserRepo.create.mockReturnValue(user);
      mockUserRepo.save.mockResolvedValue(user);

      const savedToken = makeRefreshToken();
      mockTokenRepo.create.mockReturnValue(savedToken);
      mockTokenRepo.save.mockResolvedValue(savedToken);
      mockSessionRepo.create.mockReturnValue({});
      mockSessionRepo.save.mockResolvedValue({});

      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.register({
        email: 'alice@example.com',
        username: 'alice',
        password: 'password123',
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.expiresIn).toBe(900); // 15m in seconds
    });

    it('throws ConflictException when email already exists', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(makeUser()) // email exists
        .mockResolvedValueOnce(null);

      await expect(
        service.register({ email: 'alice@example.com', username: 'alice', password: 'pass1234' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when username already exists', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(null)       // email ok
        .mockResolvedValueOnce(makeUser()); // username taken

      await expect(
        service.register({ email: 'new@example.com', username: 'alice', password: 'pass1234' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns a token pair for valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 4); // low cost for tests
      const user = makeUser({ passwordHash: hash });
      mockUserRepo.findOne.mockResolvedValue(user);

      const savedToken = makeRefreshToken();
      mockTokenRepo.create.mockReturnValue(savedToken);
      mockTokenRepo.save.mockResolvedValue(savedToken);
      mockSessionRepo.create.mockReturnValue({});
      mockSessionRepo.save.mockResolvedValue({});

      mockJwtService.sign
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const result = await service.login({ email: 'alice@example.com', password: 'password123' });
      expect(result.accessToken).toBe('access-token');
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('realpassword', 4);
      mockUserRepo.findOne.mockResolvedValue(makeUser({ passwordHash: hash }));

      await expect(
        service.login({ email: 'alice@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for inactive account', async () => {
      const hash = await bcrypt.hash('password123', 4);
      mockUserRepo.findOne.mockResolvedValue(makeUser({ passwordHash: hash, isActive: false }));

      await expect(
        service.login({ email: 'alice@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── refresh ────────────────────────────────────────────────────────────────

  describe('refresh', () => {
    it('rotates the refresh token and returns a new pair', async () => {
      const payload = { sub: 'user-uuid-1', username: 'alice', role: 'user', sessionId: 'session-1' };
      mockJwtService.verify.mockReturnValue(payload);

      const stored = makeRefreshToken({ sessionId: 'session-1' });
      mockTokenRepo.findOne.mockResolvedValue(stored);
      mockTokenRepo.save.mockResolvedValue({ ...stored, revokedAt: new Date() });

      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);

      const newToken = makeRefreshToken({ id: 'rt-uuid-2' });
      mockTokenRepo.create.mockReturnValue(newToken);
      mockTokenRepo.save.mockResolvedValue(newToken);
      mockSessionRepo.create.mockReturnValue({});
      mockSessionRepo.save.mockResolvedValue({});

      mockJwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await service.refresh('old-refresh-token');
      expect(result.accessToken).toBe('new-access-token');
      // Old token should have been revoked
      expect(mockTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('throws 401 when refresh token is revoked', async () => {
      const payload = { sub: 'u1', username: 'alice', role: 'user', sessionId: 's1' };
      mockJwtService.verify.mockReturnValue(payload);

      const revokedToken = makeRefreshToken({ revokedAt: new Date() });
      mockTokenRepo.findOne.mockResolvedValue(revokedToken);

      await expect(service.refresh('revoked-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 when reusing a revoked refresh token (rotation guard)', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'u1', username: 'alice', role: 'user', sessionId: 's1',
      });
      // Token not found in DB (was previously rotated away)
      mockTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh('old-revoked-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 when verify fails (tampered / expired token)', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('jwt expired'); });

      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── logout ─────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes the refresh token for the given sessionId', async () => {
      const token = makeRefreshToken();
      mockTokenRepo.findOne.mockResolvedValue(token);
      mockTokenRepo.save.mockResolvedValue({ ...token, revokedAt: new Date() });

      await service.logout('session-uuid-1');

      expect(mockTokenRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('is a no-op when token not found', async () => {
      mockTokenRepo.findOne.mockResolvedValue(null);
      await service.logout('nonexistent-session');
      expect(mockTokenRepo.save).not.toHaveBeenCalled();
    });
  });
});
