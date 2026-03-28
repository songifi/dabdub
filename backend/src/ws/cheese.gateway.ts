import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ConfigType } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';
import { jwtConfig } from '../config/jwt.config';
import { redisConfig } from '../config/redis.config';
import type { JwtPayload } from '../auth/auth.service';

export const WS_EVENTS = {
  TRANSFER_SENT: 'transfer_sent',
  TRANSFER_RECEIVED: 'transfer_received',
  BALANCE_UPDATED: 'balance_updated',
  PAYLINK_PAID: 'paylink_paid',
  NOTIFICATION_NEW: 'notification_new',
  RANK_CHANGED: 'rank_changed',
  SYSTEM_MESSAGE: 'system_message',
} as const;

const REDIS_WS_PREFIX = 'ws:connections:';

@WebSocketGateway({
  namespace: '/cheese',
  transports: ['websocket'],
  cors: { origin: process.env['FRONTEND_URL'] },
})
export class CheeseGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(CheeseGateway.name);
  private readonly redis: Redis;

  constructor(
    private readonly jwtService: JwtService,

    @Inject(jwtConfig.KEY)
    private readonly jwt: ConfigType<typeof jwtConfig>,

    @Inject(redisConfig.KEY)
    redisCfg: ConfigType<typeof redisConfig>,
  ) {
    this.redis = new Redis({
      host: redisCfg.host,
      port: redisCfg.port,
      password: redisCfg.password,
    });
    this.redis.on('error', (err: Error) =>
      this.logger.warn(`WS Redis error: ${err.message}`),
    );
  }

  async handleConnection(client: Socket): Promise<void> {
    const token: string | undefined = client.handshake.auth?.token;

    if (!token) {
      client.disconnect();
      return;
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.jwt.accessSecret,
      });
    } catch {
      client.disconnect();
      return;
    }

    const userRoom = `user:${payload.sub}`;
    await client.join(userRoom);
    await this.redis.hset(`${REDIS_WS_PREFIX}${payload.sub}`, client.id, '1');

    if (payload.role === 'admin' || payload.role === 'super_admin') {
      await client.join('admin');
    }

    (client as Socket & { userId: string }).userId = payload.sub;
    this.logger.debug(`Client ${client.id} joined room ${userRoom}`);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = (client as Socket & { userId?: string }).userId;
    if (userId) {
      await this.redis.hdel(`${REDIS_WS_PREFIX}${userId}`, client.id);
    }
  }

  async emitToUser(
    userId: string,
    event: string,
    data: unknown,
  ): Promise<void> {
    const sockets = await this.redis.hkeys(`${REDIS_WS_PREFIX}${userId}`);
    if (sockets.length === 0) return;
    this.server.to(`user:${userId}`).emit(event, data);
  }

  async getStats(): Promise<{ connectedUsers: number; totalSockets: number }> {
    const keys = await this.redis.keys(`${REDIS_WS_PREFIX}*`);
    let totalSockets = 0;
    for (const key of keys) {
      totalSockets += await this.redis.hlen(key);
    }
    return { connectedUsers: keys.length, totalSockets };
  }
}
