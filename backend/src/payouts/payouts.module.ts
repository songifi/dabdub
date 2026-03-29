import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduledPayout } from './entities/scheduled-payout.entity';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsProcessor } from './payouts.processor';
import { TransfersModule } from '../transfers/transfers.module';
import { UsersModule } from '../users/users.module';
import { PinModule } from '../pin/pin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledPayout]),
    BullModule.registerQueue({
      name: 'payouts',
    }),
    TransfersModule,
    UsersModule,
    PinModule,
  ],
  providers: [PayoutsService, PayoutsProcessor],
  controllers: [PayoutsController],
  exports: [PayoutsService],
})
export class PayoutsModule {}
