import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { AdminMeController } from './admin-me.controller';
import { AdminActivityFeedService } from './services/admin-activity-feed.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminProfileService } from './services/admin-profile.service';
import { AdminActivityFeedItem } from '../database/entities/admin-activity-feed-item.entity';
import { UserEntity } from '../database/entities/user.entity';
import { Merchant } from '../database/entities/merchant.entity';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { AdminActivityListener } from './listeners/admin-activity.listener';

@Module({
    imports: [
        TypeOrmModule.forFeature([AdminActivityFeedItem, UserEntity, Merchant]),
        CacheModule.register({
            ttl: 10000, // 10 seconds default for this module if used
        }),
        AuthModule,
        AuditModule,
    ],
    controllers: [AdminMeController],
    providers: [
        AdminActivityFeedService,
        AdminDashboardService,
        AdminProfileService,
        AdminActivityListener,
    ],
    exports: [AdminActivityFeedService],
})
export class AdminMeModule { }
