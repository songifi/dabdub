import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '../cache/cache.module';
import { CronModule } from '../cron/cron.module';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushModule } from '../push/push.module';
import { RateSnapshot } from './entities/rate-snapshot.entity';
import { RateAlert } from './entities/rate-alert.entity';
import { User } from '../users/entities/user.entity';
import { RatesService } from './rates.service';
import { RatesProcessor } from './rates.processor';
import { RatesController } from './rates.controller';
import { RateAlertService, RATE_ALERT_QUEUE } from './rate-alert.service';
import { RateAlertProcessor } from './rate-alert.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([RateSnapshot, RateAlert, User]),
    CacheModule,
    BullModule.registerQueue({ name: 'rates' }),
    BullModule.registerQueue({ name: RATE_ALERT_QUEUE }),
    CronModule,
    EmailModule,
    NotificationsModule,
    PushModule,
  ],
  providers: [RatesService, RatesProcessor, RateAlertService, RateAlertProcessor],
  controllers: [RatesController],
  exports: [RatesService, RateAlertService],
})
export class RatesModule {}
