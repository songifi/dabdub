import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserRole, ROLE_PERMISSIONS } from '../../database/entities/user.entity';
import { Merchant, KycStatus } from '../../database/entities/merchant.entity';
// import { WebhookDeliveryLogEntity } from '../database/entities/webhook-delivery-log.entity';
// Note: Other entities might be in different modules, we'll use repository injections if available
// or just return 0 for now if they are not easily accessible in this phase

@Injectable()
export class AdminDashboardService {
    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
        @InjectRepository(Merchant)
        private readonly merchantRepository: Repository<Merchant>,
    ) { }

    async getDashboardData(admin: UserEntity) {
        const stats: any = {};

        if (admin.role === UserRole.OPERATIONS_ADMIN || admin.role === UserRole.ADMIN || admin.role === UserRole.SUPER_ADMIN) {
            stats.pendingKycReviews = await this.merchantRepository.count({
                where: { kycStatus: KycStatus.PENDING }, // Adjust based on actual enum values if needed
            });
            stats.openAlerts = 0; // To be implemented with Risk module
            stats.merchantsToFollow = 0; // Placeholder
        }

        if (admin.role === UserRole.SUPPORT_ADMIN || admin.role === UserRole.ADMIN || admin.role === UserRole.SUPER_ADMIN) {
            stats.assignedSupportTickets = 0; // To be implemented with Support module
        }

        if (admin.role === UserRole.FINANCE_ADMIN || admin.role === UserRole.ADMIN || admin.role === UserRole.SUPER_ADMIN) {
            stats.pendingSettlements = 0; // To be implemented with Settlement module
            stats.pendingWebhookRetries = 0; // placeholder
        }

        const quickLinks = this.getQuickLinks(admin.role, stats);

        return {
            admin: {
                id: admin.id,
                email: admin.email,
                role: admin.role,
                permissions: ROLE_PERMISSIONS[admin.role] || [],
            },
            stats,
            quickLinks,
        };
    }

    private getQuickLinks(role: UserRole, stats: any) {
        const links = [];

        if (role === UserRole.OPERATIONS_ADMIN || role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) {
            links.push({
                label: 'Pending KYC',
                url: '/merchants?status=KYC_SUBMITTED',
                count: stats.pendingKycReviews || 0,
            });
        }

        if (role === UserRole.SUPPORT_ADMIN || role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) {
            links.push({
                label: 'My Tickets',
                url: '/support/tickets?assignedToMe=true',
                count: stats.assignedSupportTickets || 0,
            });
        }

        return links;
    }
}
