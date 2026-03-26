import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TierConfig } from './entities/tier-config.entity';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TierService } from './tier.service';
import { TierController } from './tier.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TierConfig, User, Transaction])],
  providers: [TierService],
  controllers: [TierController],
  exports: [TierService],
})
export class TierConfigModule {}
