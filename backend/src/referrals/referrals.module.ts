import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../notification/notification.module';
import { GlobalConfigModule } from '../config/config.module';
import { UserEntity } from '../database/entities/user.entity';
import { StellarModule } from '../stellar/stellar.module';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { Referral } from './entities/referral.entity';
import { ReferralProcessor } from './referral.processor';
import { ReferralsController } from './referrals.controller';
import { ReferralService } from './referral.service';

@Module({
  imports: [
    GlobalConfigModule,
    NotificationModule,
    StellarModule,
    TypeOrmModule.forFeature([Referral, UserEntity]),
    BullModule.registerQueue({
      name: 'referrals',
    }),
  ],
  controllers: [ReferralsController],
  providers: [ReferralService, ReferralProcessor, JwtGuard],
  exports: [ReferralService],
})
export class ReferralsModule {}
