import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import type { ConfigType } from '@nestjs/config';
import { redisConfig } from '../config/redis.config';
import { CheeseGateway, WS_EVENTS } from '../ws/cheese.gateway';
import { Notification } from './entities/notification.entity';
import type { NotificationType } from './notifications.types';

const UNREAD_COUNT_TTL_SECONDS = 30;
const unreadCountKey = (userId: string) => `notifications:unread-count:${userId}`;

type CursorPayload = { createdAt: string; id: string };

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(raw: string): CursorPayload {
  const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as CursorPayload;
  if (!parsed?.createdAt || !parsed?.id) {
    throw new Error('Invalid cursor');
  }
  return parsed;
}

@Injectable()
export class NotificationService {
  private readonly redis: Redis;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    private readonly gateway: CheeseGateway,

    @Inject(redisConfig.KEY)
    redisCfg: ConfigType<typeof redisConfig>,
  ) {
    this.redis = new Redis({
      host: redisCfg.host,
      port: redisCfg.port,
      password: redisCfg.password,
    });
  }

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    metadata: Record<string, unknown> = {},
  ): Promise<Notification> {
    const notif = this.notificationRepo.create({
      userId,
      type,
      title,
      body,
      metadata,
      isRead: false,
      readAt: null,
    });
    const saved = await this.notificationRepo.save(notif);

    await this.invalidateUnreadCount(userId);
    await this.gateway.emitToUser(userId, WS_EVENTS.NOTIFICATION_NEW, saved);

    return saved;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const cached = await this.redis.get(unreadCountKey(userId));
    if (cached != null) {
      const n = parseInt(cached, 10);
      return Number.isFinite(n) ? n : 0;
    }

    const count = await this.notificationRepo.count({
      where: { userId, isRead: false },
    });
    await this.redis.set(unreadCountKey(userId), String(count), 'EX', UNREAD_COUNT_TTL_SECONDS);
    return count;
  }

  async listForUser(
    userId: string,
    opts: { limit?: number; cursor?: string },
  ): Promise<{ items: Notification[]; nextCursor: string | null }> {
    const limit = opts.limit ?? 20;
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .orderBy('n.created_at', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .take(limit + 1);

    if (opts.cursor) {
      const { createdAt, id } = decodeCursor(opts.cursor);
      qb.andWhere(
        '(n.created_at < :createdAt OR (n.created_at = :createdAt AND n.id < :id))',
        { createdAt: new Date(createdAt), id },
      );
    }

    const rows = await qb.getMany();
    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;

    const last = items[items.length - 1];
    const nextCursor = hasNext && last
      ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
      : null;

    return { items, nextCursor };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const existing = await this.notificationRepo.findOne({
      where: { id: notificationId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    if (!existing.isRead) {
      existing.isRead = true;
      existing.readAt = new Date();
      await this.notificationRepo.save(existing);
    }

    await this.invalidateUnreadCount(userId);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: () => 'NOW()' })
      .where('user_id = :userId', { userId })
      .andWhere('is_read = false')
      .execute();

    await this.invalidateUnreadCount(userId);
  }

  private async invalidateUnreadCount(userId: string): Promise<void> {
    await this.redis.del(unreadCountKey(userId));
  }

  async broadcast(title: string, body: string, segment: string): Promise<void> {
    // Basic implementation: log the broadcast. 
    // In a real system, this would trigger a Bull job to notify users in the segment.
    console.log(`[BROADCAST] Segment: ${segment}, Title: ${title}, Body: ${body}`);
  }
}

