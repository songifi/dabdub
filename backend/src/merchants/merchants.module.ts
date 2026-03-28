import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { Merchant } from './entities/merchant.entity';
import { MerchantsAdminController } from './merchants-admin.controller';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';

@Module({
  imports: [TypeOrmModule.forFeature([Merchant, User]), NotificationsModule],
  controllers: [MerchantsController, MerchantsAdminController],
  providers: [MerchantsService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
