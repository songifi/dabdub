import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  CredentialDeviceType,
} from '@simplewebauthn/server';
import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
} from '@simplewebauthn/server';
import { REDIS_CLIENT } from '../cache/redis.module';
import { PasskeyCredential, PasskeyDeviceType } from './entities/passkey-credential.entity';
import { User } from '../users/entities/user.entity';
import { AuthService } from '../auth/auth.service';

const CHALLENGE_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class PasskeyService {
  constructor(
    @InjectRepository(PasskeyCredential)
    private readonly passkeyRepo: Repository<PasskeyCredential>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly authService: AuthService,

    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // ── Registration Options ───────────────────────────────────────

  async generateRegistrationOptions(
    userId: string,
    nickname?: string,
  ): Promise<{ options: Record<string, unknown>; sessionId: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get existing credentials to exclude them from registration
    const existingCredentials = await this.passkeyRepo.find({
      where: { userId },
      select: ['credentialId', 'transports'],
    });

    const options: GenerateRegistrationOptionsOpts = {
      rpName: 'Dabdub',
      rpID: this.getRpId(),
      userID: userId,
      userName: user.username,
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((cred) => ({
        id: cred.credentialId,
        type: 'public-key',
        transports: cred.transports as AuthenticatorTransportFuture[] | undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    };

    const registrationOptions = await generateRegistrationOptions(options);

    // Store challenge in Redis with TTL
    const sessionId = this.generateSessionId();
    const challengeKey = `passkey:challenge:register:${sessionId}`;
    await this.redis.setex(
      challengeKey,
      CHALLENGE_TTL_SECONDS,
      JSON.stringify({
        challenge: registrationOptions.challenge,
        userId,
        nickname,
      }),
    );

    return {
      options: registrationOptions as unknown as Record<string, unknown>,
      sessionId,
    };
  }

  // ── Registration Verification ──────────────────────────────────

  async verifyRegistration(
    sessionId: string,
    response: RegistrationResponseJSON,
    nickname?: string,
    ipAddress?: string,
  ): Promise<void> {
    // Load challenge from Redis
    const challengeKey = `passkey:challenge:register:${sessionId}`;
    const challengeData = await this.redis.get(challengeKey);
    if (!challengeData) {
      throw new BadRequestException('Challenge expired or not found');
    }

    const { challenge, userId } = JSON.parse(challengeData);

    try {
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: this.getExpectedOrigin(),
        expectedRPID: this.getRpId(),
        requireUserVerification: true,
      });

      const { verified, registrationInfo } = verification;

      if (!verified || !registrationInfo) {
        throw new BadRequestException('Registration verification failed');
      }

      const {
        credential,
        credentialType,
        credentialDeviceType,
        aaguid,
        webauthnUser,
      } = registrationInfo;

      // Create and persist the credential
      const passkeyCredential = this.passkeyRepo.create({
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        deviceType:
          credentialDeviceType === 'multiDevice'
            ? PasskeyDeviceType.MULTI_DEVICE
            : PasskeyDeviceType.SINGLE_DEVICE,
        backedUp: credential.backedUp,
        transports: response.response.transports || null,
        nickname: nickname || null,
      });

      await this.passkeyRepo.save(passkeyCredential);

      // Delete challenge from Redis
      await this.redis.del(challengeKey);
    } catch (error) {
      throw new BadRequestException('Registration verification failed');
    }
  }

  // ── Authentication Options ─────────────────────────────────────

  async generateAuthenticationOptions(
    userId?: string,
  ): Promise<{ options: Record<string, unknown>; sessionId: string }> {
    let credentials: Array<{ id: string; transports?: AuthenticatorTransportFuture[] }> = [];

    if (userId) {
      // Get user's credentials
      const userCredentials = await this.passkeyRepo.find({
        where: { userId },
        select: ['credentialId', 'transports'],
      });
      credentials = userCredentials.map((cred) => ({
        id: cred.credentialId,
        transports: cred.transports as AuthenticatorTransportFuture[] | undefined,
      }));
    }

    const options: GenerateAuthenticationOptionsOpts = {
      timeout: 60000,
      userVerification: 'preferred',
      allowCredentials: credentials.length > 0 ? credentials : undefined,
      rpId: this.getRpId(),
    };

    const authOptions = await generateAuthenticationOptions(options);

    // Store challenge in Redis with TTL
    const sessionId = this.generateSessionId();
    const challengeKey = `passkey:challenge:auth:${sessionId}`;
    await this.redis.setex(
      challengeKey,
      CHALLENGE_TTL_SECONDS,
      JSON.stringify({
        challenge: authOptions.challenge,
        userId,
      }),
    );

    return {
      options: authOptions as unknown as Record<string, unknown>,
      sessionId,
    };
  }

  // ── Authentication Verification ────────────────────────────────

  async verifyAuthentication(
    sessionId: string,
    response: AuthenticationResponseJSON,
    ipAddress?: string,
    deviceInfo?: Record<string, unknown>,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    // Load challenge from Redis
    const challengeKey = `passkey:challenge:auth:${sessionId}`;
    const challengeData = await this.redis.get(challengeKey);
    if (!challengeData) {
      throw new BadRequestException('Challenge expired or not found');
    }

    const { challenge } = JSON.parse(challengeData);

    // Get the credential from the response
    const credential = await this.passkeyRepo.findOne({
      where: { credentialId: response.id },
      relations: ['user'],
    });

    if (!credential) {
      throw new UnauthorizedException('Credential not found');
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: this.getExpectedOrigin(),
        expectedRPID: this.getRpId(),
        credential: {
          id: credential.credentialId,
          publicKey: credential.publicKey,
          counter: credential.counter,
          transports: (credential.transports as AuthenticatorTransportFuture[]) || undefined,
        },
        requireUserVerification: true,
      });

      const { verified, authenticationInfo } = verification;

      if (!verified || !authenticationInfo) {
        throw new UnauthorizedException('Authentication verification failed');
      }

      // Check for counter regression (replay attack detection)
      if (authenticationInfo.newCounter <= credential.counter) {
        throw new UnauthorizedException(
          'Counter regression detected - possible replay attack',
        );
      }

      // Update the counter
      credential.counter = authenticationInfo.newCounter;
      await this.passkeyRepo.save(credential);

      // Delete challenge from Redis
      await this.redis.del(challengeKey);

      // Issue JWT tokens
      return this.authService.issueTokens(
        credential.user,
        this.generateSessionId(),
        ipAddress,
        deviceInfo,
      );
    } catch (error) {
      if (error.message.includes('Counter regression')) {
        throw error;
      }
      throw new UnauthorizedException('Authentication verification failed');
    }
  }

  // ── List Credentials ───────────────────────────────────────────

  async listCredentials(userId: string): Promise<PasskeyCredential[]> {
    return this.passkeyRepo.find({
      where: { userId },
      select: [
        'id',
        'credentialId',
        'deviceType',
        'backedUp',
        'transports',
        'nickname',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
    });
  }

  // ── Delete Credential ──────────────────────────────────────────

  async deleteCredential(userId: string, credentialId: string): Promise<void> {
    const credential = await this.passkeyRepo.findOne({
      where: { id: credentialId, userId },
    });

    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    // Check if this is the last credential
    const count = await this.passkeyRepo.count({ where: { userId } });
    if (count <= 1) {
      throw new BadRequestException(
        'Cannot delete the last credential. At least one authentication method must remain.',
      );
    }

    await this.passkeyRepo.remove(credential);
  }

  // ── Helpers ────────────────────────────────────────────────────

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private getRpId(): string {
    // Use environment variable or derive from request
    return process.env.WEBAUTHN_RP_ID || 'localhost';
  }

  private getExpectedOrigin(): string {
    return process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';
  }
}
