import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AdminActivityFeedItem } from '../../database/entities/admin-activity-feed-item.entity';
import { FeedItemType } from '../../database/entities/admin-activity-feed.enums';

@Injectable()
export class AdminActivityFeedService {
    private readonly logger = new Logger(AdminActivityFeedService.name);

    constructor(
        @InjectRepository(AdminActivityFeedItem)
        private readonly feedRepository: Repository<AdminActivityFeedItem>,
    ) { }

    async getFeed(adminId: string, query: {
        type?: FeedItemType;
        isRead?: boolean;
        createdAfter?: Date;
        page?: number;
        limit?: number;
    }) {
        const { type, isRead, createdAfter, page = 1, limit = 10 } = query;
        const qb = this.feedRepository.createQueryBuilder('feed');

        qb.where('feed.adminId = :adminId', { adminId });

        if (type) {
            qb.andWhere('feed.type = :type', { type });
        }

        if (isRead !== undefined) {
            qb.andWhere('feed.isRead = :isRead', { isRead });
        }

        if (createdAfter) {
            qb.andWhere('feed.createdAt > :createdAfter', { createdAfter });
        }

        qb.orderBy('feed.eventAt', 'DESC');
        qb.take(limit);
        qb.skip((page - 1) * limit);

        const [items, total] = await qb.getManyAndCount();

        return {
            items,
            total,
            page,
            limit,
        };
    }

    async markRead(adminId: string, ids: string[] | 'all') {
        const qb = this.feedRepository.createQueryBuilder()
            .update(AdminActivityFeedItem)
            .set({ isRead: true, readAt: new Date() })
            .where('adminId = :adminId', { adminId })
            .andWhere('isRead = false');

        if (ids !== 'all') {
            qb.andWhere('id IN (:...ids)', { ids });
        }

        const result = await qb.execute();
        return result.affected ?? 0;
    }

    async getUnreadCount(adminId: string) {
        return this.feedRepository.count({
            where: { adminId, isRead: false },
        });
    }

    async createFeedItem(data: Partial<AdminActivityFeedItem>) {
        const item = this.feedRepository.create(data);
        return this.feedRepository.save(item);
    }
}
