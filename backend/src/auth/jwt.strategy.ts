import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SessionsService } from './session/sessions.service';
import { RedisService } from 'nestjs-redis';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    const sessionId = payload.sessionId;
    const redisClient = this.redisService.getClient();

    // Check session in Redis
    const session = await redisClient.get(`session:${sessionId}`);
    if (!session) {
      throw new UnauthorizedException('Session not found or expired');
    }

    const parsedSession = JSON.parse(session);

    // Check if session is revoked
    if (parsedSession.revokedAt) {
      throw new UnauthorizedException('Session has been revoked');
    }

    // Update lastActiveAt asynchronously
    this.sessionsService.touch(sessionId);

    return { userId: parsedSession.userId, sessionId };
  }
}