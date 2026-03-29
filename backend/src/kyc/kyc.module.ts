import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycSubmission } from './entities/kyc-submission.entity';
import { VerificationResult } from './entities/verification-result.entity';
import { KycService } from './kyc.service';
import { KycController } from './kyc.controller';
import { User } from '../users/entities/user.entity';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { R2Module } from '../r2/r2.module';
import { PremblyModule } from '../prembly/prembly.module';
import { TierConfigModule } from '../tier-config/tier-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycSubmission, VerificationResult, User]),
    EmailModule,
    NotificationsModule,
    R2Module,
    PremblyModule,
    TierConfigModule,
  ],
  providers: [KycService],
  controllers: [KycController],
  exports: [KycService],
})
export class KycModule {}
