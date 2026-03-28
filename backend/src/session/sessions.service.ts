import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { RedisService } from 'nestjs-redis';
import { Session } from './session.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly redisService: RedisService,
  ) {}

  async create(userId: string, deviceInfo: Record<string, any>, ip: string): Promise<string> {
    const session = this.sessionRepository.create({
      userId,
      deviceInfo,
      ipAddress: ip,
      lastActiveAt: new Date(),
    });
    const savedSession = await this.sessionRepository.save(session);
    await this.cacheSession(savedSession);
    return savedSession.id;
  }

  async touch(sessionId: string): Promise<void> {
    await this.sessionRepository.update(sessionId, { lastActiveAt: new Date() });
    const session = await this.getSessionFromCache(sessionId);
    if (session) {
      session.lastActiveAt = new Date();
      await this.cacheSession(session);
    }
  }

  async revoke(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepository.findOne({ where: { id: sessionId, userId } });
    if (session) {
      session.revokedAt = new Date();
      await this.sessionRepository.save(session);
      // TODO: Revoke associated refresh token
    }
  }

  async revokeAllExceptCurrent(userId: string, currentSessionId: string): Promise<void> {
    const redisClient = this.redisService.getClient();
    const sessions = await this.sessionRepository.find({ where: { userId } });

    for (const session of sessions) {
      if (session.id !== currentSessionId) {
        session.revokedAt = new Date();
        await this.sessionRepository.save(session);
        await redisClient.del(`session:${session.id}`);
      }
    }
  }

  async cacheSession(session: Session): Promise<void> {
    const redisClient = this.redisService.getClient();
    await redisClient.set(
      `session:${session.id}`,
      JSON.stringify(session),
      'EX',
      60, // TTL in seconds
    );
  }

  async getSessionFromCache(sessionId: string): Promise<Session | null> {
    const redisClient = this.redisService.getClient();
    const sessionData = await redisClient.get(`session:${sessionId}`);
    return sessionData ? JSON.parse(sessionData) : null;
  }

  async getAllSessions(userId: string): Promise<Session[]> {
    return this.sessionRepository.find({ where: { userId, revokedAt: IsNull() } });
  }
}