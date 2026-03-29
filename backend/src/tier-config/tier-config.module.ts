import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TierConfig } from './entities/tier-config.entity';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TierService } from './tier.service';
import { TierUpgradeService } from './tier-upgrade.service';
import { TierController } from './tier.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TierConfig, User, Transaction]),
    EmailModule,
  ],
  providers: [TierService, TierUpgradeService],
  controllers: [TierController],
  exports: [TierService, TierUpgradeService],
})
export class TierConfigModule {}
