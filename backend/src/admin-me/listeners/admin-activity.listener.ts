import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AdminActivityFeedService } from '../services/admin-activity-feed.service';
import { AdminEvents, AdminActivityEvent } from '../events/admin-activity.events';
import { FeedItemType } from '../../database/entities/admin-activity-feed.enums';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { In, Repository } from 'typeorm';

@Injectable()
export class AdminActivityListener {
    private readonly logger = new Logger(AdminActivityListener.name);

    constructor(
        private readonly feedService: AdminActivityFeedService,
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
    ) { }

    @OnEvent('admin.activity.*')
    async handlePlatformEvent(event: AdminActivityEvent) {
        // If adminId is provided, just create for that admin
        if (event.adminId) {
            await this.createItem(event.adminId, event);
            return;
        }

        // Otherwise, find relevant admins based on event type
        const roles = this.getTargetRolesForEvent(event.type);
        const admins = await this.userRepository.find({
            where: { role: In(roles), isActive: true },
        });

        for (const admin of admins) {
            await this.createItem(admin.id, event);
        }
    }

    private async createItem(adminId: string, event: AdminActivityEvent) {
        try {
            await this.feedService.createFeedItem({
                adminId,
                type: this.mapEventToFeedType(event.type),
                title: event.title,
                detail: event.detail,
                resourceType: event.resourceType,
                resourceId: event.resourceId,
                resourceUrl: event.resourceUrl,
                eventAt: new Date(),
            });
        } catch (error) {
            this.logger.error(`Failed to create feed item for admin ${adminId}: ${error.message}`);
        }
    }

    private getTargetRolesForEvent(eventType: string): UserRole[] {
        switch (eventType) {
            case AdminEvents.KYC_SUBMITTED:
                return [UserRole.OPERATIONS_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN];
            case AdminEvents.SETTLEMENT_REQUESTED:
                return [UserRole.FINANCE_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN];
            case AdminEvents.SUPPORT_TICKET_ASSIGNED:
                return [UserRole.SUPPORT_ADMIN, UserRole.ADMIN, UserRole.SUPER_ADMIN];
            default:
                return [UserRole.ADMIN, UserRole.SUPER_ADMIN];
        }
    }

    private mapEventToFeedType(eventType: string): FeedItemType {
        if (eventType === AdminEvents.SUPPORT_TICKET_ASSIGNED) return FeedItemType.ASSIGNED_TASK;
        if (eventType.includes('requested') || eventType.includes('submitted')) return FeedItemType.PLATFORM_EVENT;
        return FeedItemType.TEAM_ACTION;
    }
}
