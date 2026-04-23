import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../auth/entities/session.entity';
import { User } from '../users/entities/user.entity';
import { MerchantAnalyticsController } from './merchant-analytics.controller';
import { MerchantAnalyticsService } from './merchant-analytics.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session])],
  controllers: [MerchantAnalyticsController],
  providers: [MerchantAnalyticsService],
})
export class MerchantAnalyticsModule {}
