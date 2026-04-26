import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InAppNotification } from './entities/in-app-notification.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(InAppNotification)
    private readonly repo: Repository<InAppNotification>,
  ) {}

  async create(merchantId: string, type: string, message: string): Promise<InAppNotification> {
    return this.repo.save(this.repo.create({ merchantId, type, message }));
  }

  async getUnreadCount(merchantId: string): Promise<number> {
    return this.repo.count({ where: { merchantId, read: false } });
  }

  async listForUser(
    merchantId: string,
    opts: { limit: number; cursor?: string },
  ): Promise<{ items: InAppNotification[]; nextCursor: string | null }> {
    const limit = Math.min(opts.limit ?? 20, 100);
    const qb = this.repo
      .createQueryBuilder('n')
      .where('n.merchantId = :merchantId', { merchantId })
      .orderBy('n.createdAt', 'DESC')
      .limit(limit + 1);

    if (opts.cursor) {
      qb.andWhere('n.createdAt < (SELECT "createdAt" FROM in_app_notifications WHERE id = :cursor)', {
        cursor: opts.cursor,
      });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { items, nextCursor };
  }

  async markRead(merchantId: string, id: string): Promise<void> {
    const notification = await this.repo.findOne({ where: { id, merchantId } });
    if (!notification) throw new NotFoundException('Notification not found');
    notification.read = true;
    await this.repo.save(notification);
  }

  async markAllRead(merchantId: string): Promise<void> {
    await this.repo.update({ merchantId, read: false }, { read: true });
  }

  /** Auto-purge notifications older than 30 days — runs daily at midnight */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeOldNotifications(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    await this.repo.delete({ createdAt: LessThan(cutoff) });
  }
}
