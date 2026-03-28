import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SentryUserMiddleware } from './sentry-user.middleware';
import { SentryAlertService } from './sentry-alert.service';
import { SentryTypeORMSubscriber } from './sentry-typeorm.subscriber';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SentryUserMiddleware, SentryAlertService, SentryTypeORMSubscriber],
  exports: [SentryUserMiddleware, SentryAlertService],
})
export class SentryModule {}
