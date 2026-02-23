import {
    Controller,
    Get,
    Patch,
    Post,
    Body,
    UseGuards,
    Query,
    Request,
    HttpStatus,
    HttpCode,
    Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminJwtGuard } from '../auth/guards/admin-jwt.guard';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminActivityFeedService } from './services/admin-activity-feed.service';
import { AdminProfileService } from './services/admin-profile.service';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { FeedItemType } from '../database/entities/admin-activity-feed.enums';
import { AdminAuthService } from '../auth/services/admin-auth.service';

@ApiTags('Admin Me')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('api/v1/me')
export class AdminMeController {
    constructor(
        private readonly dashboardService: AdminDashboardService,
        private readonly activityFeedService: AdminActivityFeedService,
        private readonly profileService: AdminProfileService,
        private readonly adminAuthService: AdminAuthService,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) { }

    @Get('dashboard')
    @ApiOperation({ summary: "Admin personal dashboard" })
    async getDashboard(@Request() req: any) {
        const admin = req.user;
        const dashboard = await this.dashboardService.getDashboardData(admin);
        const recentActivity = await this.activityFeedService.getFeed(admin.id, { limit: 10 });

        return {
            ...dashboard,
            recentActivity: recentActivity.items,
        };
    }

    @Get('activity')
    @ApiOperation({ summary: "Admin activity feed (paginated)" })
    async getActivity(
        @Request() req: any,
        @Query('type') type?: FeedItemType,
        @Query('isRead') isRead?: boolean,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.activityFeedService.getFeed(req.user.id, { type, isRead, page, limit });
    }

    @Post('activity/mark-read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Mark feed items as read" })
    async markRead(@Request() req: any, @Body() body: { ids: string[] | 'all' }) {
        const count = await this.activityFeedService.markRead(req.user.id, body.ids);
        return { success: true, affected: count };
    }

    @Get('activity/unread-count')
    @ApiOperation({ summary: "Unread feed items count" })
    async getUnreadCount(@Request() req: any) {
        const cacheKey = `admin_unread_count_${req.user.id}`;
        const cached = await this.cacheManager.get<{ count: number }>(cacheKey);
        if (cached) return cached;

        const count = await this.activityFeedService.getUnreadCount(req.user.id);
        const result = { count };

        await this.cacheManager.set(cacheKey, result, 10000); // 10 seconds
        return result;
    }

    @Get('profile')
    @ApiOperation({ summary: "Get own admin profile" })
    async getProfile(@Request() req: any) {
        return this.profileService.getProfile(req.user.id);
    }

    @Patch('profile')
    @ApiOperation({ summary: "Update own profile" })
    async updateProfile(@Request() req: any, @Body() dto: UpdateOwnProfileDto) {
        return this.profileService.updateProfile(req.user.id, dto);
    }

    @Get('sessions')
    @ApiOperation({ summary: "Own active sessions" })
    async getSessions(@Request() req: any) {
        const admin = req.user as any;
        const sessions = await this.adminAuthService.getSessions(admin.id, admin.sessionId);
        return { sessions };
    }

    @Get('audit-log')
    @ApiOperation({ summary: "Own audit actions" })
    async getAuditLog(
        @Request() req: any,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.profileService.getAuditLog(req.user.id, { page, limit });
    }
}
