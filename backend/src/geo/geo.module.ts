import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeoService } from './geo.service';
import { GeoBlockMiddleware } from './geo-block.middleware';
import { AppConfigModule } from '../app-config/app-config.module';
import { WaitlistFraudLog } from '../waitlist/entities/waitlist-fraud-log.entity';
import { SecurityAlert } from '../security/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([WaitlistFraudLog, SecurityAlert]),
    AppConfigModule,
  ],
  providers: [GeoService, GeoBlockMiddleware],
  exports: [GeoService, GeoBlockMiddleware],
})
export class GeoModule {}
