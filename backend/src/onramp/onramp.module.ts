import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule, InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { FeeConfig } from '../fee-config/entities/fee-config.entity';
import { User } from '../users/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { SorobanModule } from '../soroban/soroban.module';
import { OnRampController } from './onramp.controller';
import { OnRampOrder } from './onramp-order.entity';
import { OnRampService } from './onramp.service';
import { OnRampCronService } from './onramp-cron.service';
import { FlutterwaveClient } from './flutterwave.client';
import { OnRampWebhookController } from './onramp-webhook.controller';
import {
  EXPIRE_ONRAMP_ORDERS_JOB,
  ONRAMP_QUEUE,
  OnRampExpiryProcessor,
} from './processors/onramp-expiry.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([OnRampOrder, FeeConfig, User, Transaction]),
    BullModule.registerQueue({ name: ONRAMP_QUEUE }),
    SorobanModule,
  ],
  providers: [OnRampService, OnRampCronService, FlutterwaveClient, OnRampExpiryProcessor],
  controllers: [OnRampController, OnRampWebhookController],
  exports: [OnRampService],
})
export class OnRampModule implements OnModuleInit {
  constructor(@InjectQueue(ONRAMP_QUEUE) private readonly onRampQueue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.onRampQueue.add(
      EXPIRE_ONRAMP_ORDERS_JOB,
      {},
      {
        repeat: { every: 5 * 60_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
