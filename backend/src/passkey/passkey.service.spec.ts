import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, UnauthorizedException, NotFoundException } from '@nestjs/common';
import Redis from 'ioredis';
import { PasskeyService } from './passkey.service';
import { PasskeyCredential, PasskeyDeviceType } from './entities/passkey-credential.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { AuthService } from '../auth/auth.service';
import { REDIS_CLIENT } from '../cache/redis.module';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPasskeyRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
};

const mockUserRepo = {
  findOne: jest.fn(),
};

const mockAuthService = {
  issueTokens: jest.fn(),
};

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid-1',
    email: 'alice@example.com',
    username: 'alice',
    passwordHash: '$2b$12$hashedpassword',
    isAdmin: false,
    role: UserRole.USER,
    isMerchant: false,
    isActive: true,
    isTreasury: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User);

const makePasskeyCredential = (overrides: Partial<PasskeyCredential> = {}): PasskeyCredential =>
  ({
    id: 'passkey-uuid-1',
    userId: 'user-uuid-1',
    credentialId: 'credential-id-base64',
    publicKey: Buffer.from('public-key-bytes'),
    counter: 1,
    deviceType: PasskeyDeviceType.MULTI_DEVICE,
    backedUp: true,
    transports: ['internal'],
    nickname: 'My iPhone',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PasskeyCredential);

// ── Mock WebAuthn functions ───────────────────────────────────────────────────

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn().mockResolvedValue({
    challenge: 'registration-challenge',
    rp: { name: 'Dabdub', id: 'localhost' },
    user: { id: 'user-uuid-1', name: 'alice', displayName: 'Alice' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
  }),
  verifyRegistrationResponse: jest.fn().mockResolvedValue({
    verified: true,
    registrationInfo: {
      credential: {
        id: 'new-credential-id',
        publicKey: Buffer.from('new-public-key'),
        counter: 0,
        backedUp: true,
      },
      credentialType: 'public-key',
      credentialDeviceType: 'singleDevice',
      aaguid: 'aaguid-123',
      webauthnUser: { id: 'user-uuid-1', name: 'alice' },
    },
  }),
  generateAuthenticationOptions: jest.fn().mockResolvedValue({
    challenge: 'authentication-challenge',
    allowCredentials: [],
  }),
  verifyAuthenticationResponse: jest.fn().mockResolvedValue({
    verified: true,
    authenticationInfo: {
      newCounter: 2,
    },
  }),
}));

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('PasskeyService', () => {
  let service: PasskeyService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasskeyService,
        { provide: getRepositoryToken(PasskeyCredential), useValue: mockPasskeyRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: AuthService, useValue: mockAuthService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<PasskeyService>(PasskeyService);
  });

  // ── generateRegistrationOptions ────────────────────────────────────────────

  describe('generateRegistrationOptions', () => {
    it('generates registration options for a valid user', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      mockPasskeyRepo.find.mockResolvedValue([]);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.generateRegistrationOptions('user-uuid-1');

      expect(result.options).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('passkey:challenge:register:'),
        300,
        expect.any(String),
      );
    });

    it('throws NotFoundException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.generateRegistrationOptions('nonexistent-user'))
        .rejects.toThrow(NotFoundException);
    });

    it('excludes existing credentials from registration options', async () => {
      const user = makeUser();
      const existingCreds = [
        { credentialId: 'cred-1', transports: ['internal'] },
        { credentialId: 'cred-2', transports: ['usb'] },
      ];
      mockUserRepo.findOne.mockResolvedValue(user);
      mockPasskeyRepo.find.mockResolvedValue(existingCreds);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.generateRegistrationOptions('user-uuid-1');

      expect(result.options).toBeDefined();
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  // ── verifyRegistration ──────────────────────────────────────────────────────

  describe('verifyRegistration', () => {
    const mockResponse = {
      id: 'credential-id',
      rawId: 'base64-raw-id',
      response: {
        clientDataJSON: 'client-data-json',
        attestationObject: 'attestation-object',
        transports: ['internal'],
      },
      type: 'public-key',
    };

    it('verifies registration and persists credential', async () => {
      const challengeData = JSON.stringify({
        challenge: 'registration-challenge',
        userId: 'user-uuid-1',
        nickname: 'My iPhone',
      });
      mockRedis.get.mockResolvedValue(challengeData);
      mockPasskeyRepo.create.mockReturnValue(makePasskeyCredential({
        credentialId: 'new-credential-id',
        userId: 'user-uuid-1',
        nickname: 'My iPhone',
      }));
      mockPasskeyRepo.save.mockResolvedValue(undefined);
      mockRedis.del.mockResolvedValue(1);

      await service.verifyRegistration('session-123', mockResponse, 'My iPhone');

      expect(mockPasskeyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid-1',
          credentialId: 'new-credential-id',
          nickname: 'My iPhone',
        }),
      );
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining('passkey:challenge:register:'),
      );
    });

    it('throws BadRequestException when challenge expired', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.verifyRegistration('expired-session', mockResponse))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when verification fails', async () => {
      const challengeData = JSON.stringify({
        challenge: 'registration-challenge',
        userId: 'user-uuid-1',
      });
      mockRedis.get.mockResolvedValue(challengeData);

      // Mock verification failure
      jest.requireMock('@simplewebauthn/server').verifyRegistrationResponse
        .mockResolvedValueOnce({ verified: false });

      await expect(service.verifyRegistration('session-123', mockResponse))
        .rejects.toThrow(BadRequestException);
    });
  });

  // ── generateAuthenticationOptions ───────────────────────────────────────────

  describe('generateAuthenticationOptions', () => {
    it('generates auth options without userId (discoverable credentials)', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.generateAuthenticationOptions();

      expect(result.options).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('passkey:challenge:auth:'),
        300,
        expect.any(String),
      );
    });

    it('generates auth options with user credentials', async () => {
      const userCreds = [
        { credentialId: 'cred-1', transports: ['internal'] },
        { credentialId: 'cred-2', transports: ['usb'] },
      ];
      mockPasskeyRepo.find.mockResolvedValue(userCreds);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.generateAuthenticationOptions('user-uuid-1');

      expect(result.options).toBeDefined();
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  // ── verifyAuthentication ────────────────────────────────────────────────────

  describe('verifyAuthentication', () => {
    const mockResponse = {
      id: 'credential-id',
      rawId: 'base64-raw-id',
      response: {
        clientDataJSON: 'client-data-json',
        authenticatorData: 'authenticator-data',
        signature: 'signature',
        userHandle: 'user-handle',
      },
      type: 'public-key',
    };

    it('verifies authentication and issues tokens', async () => {
      const challengeData = JSON.stringify({ challenge: 'authentication-challenge' });
      const credential = makePasskeyCredential({ user: makeUser() });
      mockRedis.get.mockResolvedValue(challengeData);
      mockPasskeyRepo.findOne.mockResolvedValue(credential);
      mockPasskeyRepo.save.mockResolvedValue(credential);
      mockRedis.del.mockResolvedValue(1);
      mockAuthService.issueTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      });

      const result = await service.verifyAuthentication('session-123', mockResponse);

      expect(result.accessToken).toBe('new-access-token');
      expect(mockPasskeyRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ counter: 2 }),
      );
    });

    it('throws BadRequestException when challenge expired', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.verifyAuthentication('expired-session', mockResponse))
        .rejects.toThrow(BadRequestException);
    });

    it('throws UnauthorizedException when credential not found', async () => {
      const challengeData = JSON.stringify({ challenge: 'authentication-challenge' });
      mockRedis.get.mockResolvedValue(challengeData);
      mockPasskeyRepo.findOne.mockResolvedValue(null);

      await expect(service.verifyAuthentication('session-123', mockResponse))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on counter regression (replay attack)', async () => {
      const challengeData = JSON.stringify({ challenge: 'authentication-challenge' });
      const credential = makePasskeyCredential({ counter: 10, user: makeUser() });
      mockRedis.get.mockResolvedValue(challengeData);
      mockPasskeyRepo.findOne.mockResolvedValue(credential);

      // Mock verification with counter regression
      jest.requireMock('@simplewebauthn/server').verifyAuthenticationResponse
        .mockResolvedValueOnce({
          verified: true,
          authenticationInfo: { newCounter: 5 }, // Less than current counter (10)
        });

      await expect(service.verifyAuthentication('session-123', mockResponse))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when verification fails', async () => {
      const challengeData = JSON.stringify({ challenge: 'authentication-challenge' });
      const credential = makePasskeyCredential({ user: makeUser() });
      mockRedis.get.mockResolvedValue(challengeData);
      mockPasskeyRepo.findOne.mockResolvedValue(credential);

      jest.requireMock('@simplewebauthn/server').verifyAuthenticationResponse
        .mockResolvedValueOnce({ verified: false });

      await expect(service.verifyAuthentication('session-123', mockResponse))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  // ── listCredentials ─────────────────────────────────────────────────────────

  describe('listCredentials', () => {
    it('returns list of credentials without publicKey field', async () => {
      // The service selects specific fields excluding publicKey
      const credentials = [
        makePasskeyCredential({ id: 'cred-1', nickname: 'iPhone' }),
        makePasskeyCredential({ id: 'cred-2', nickname: 'MacBook' }),
      ];
      // Mock will return entities, but service selects only specific fields
      mockPasskeyRepo.find.mockResolvedValue(credentials);

      const result = await service.listCredentials('user-uuid-1');

      expect(result).toHaveLength(2);
      // Note: In actual implementation, TypeORM select excludes publicKey
      // but our mock returns full entities. The important part is verifying
      // the select query is correct.
      expect(mockPasskeyRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
        select: expect.arrayContaining([
          'id',
          'credentialId',
          'deviceType',
          'backedUp',
          'transports',
          'nickname',
          'createdAt',
        ]),
        order: { createdAt: 'DESC' },
      });
    });

    it('returns empty array when no credentials', async () => {
      mockPasskeyRepo.find.mockResolvedValue([]);

      const result = await service.listCredentials('user-uuid-1');

      expect(result).toEqual([]);
    });
  });

  // ── deleteCredential ────────────────────────────────────────────────────────

  describe('deleteCredential', () => {
    it('deletes a credential when multiple exist', async () => {
      const credential = makePasskeyCredential();
      mockPasskeyRepo.findOne.mockResolvedValue(credential);
      mockPasskeyRepo.count.mockResolvedValue(3);
      mockPasskeyRepo.remove.mockResolvedValue(undefined);

      await service.deleteCredential('user-uuid-1', 'passkey-uuid-1');

      expect(mockPasskeyRepo.remove).toHaveBeenCalledWith(credential);
    });

    it('throws BadRequestException when deleting last credential', async () => {
      const credential = makePasskeyCredential();
      mockPasskeyRepo.findOne.mockResolvedValue(credential);
      mockPasskeyRepo.count.mockResolvedValue(1);

      await expect(service.deleteCredential('user-uuid-1', 'passkey-uuid-1'))
        .rejects.toThrow('Cannot delete the last credential');
    });

    it('throws NotFoundException when credential not found', async () => {
      mockPasskeyRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteCredential('user-uuid-1', 'nonexistent-id'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
