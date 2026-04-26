import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantsService } from './merchants.service';
import { MerchantsController } from './merchants.controller';
import { AdminMerchantsController } from './admin-merchants.controller';
import { Merchant } from './entities/merchant.entity';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { NotificationPrefsService } from '../notifications/notification-prefs.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [TypeOrmModule.forFeature([Merchant, AdminAuditLog, NotificationPreference]), CacheModule],
  controllers: [MerchantsController, AdminMerchantsController],
  providers: [MerchantsService, NotificationPrefsService],
  exports: [MerchantsService, NotificationPrefsService],
})
export class MerchantsModule {}
