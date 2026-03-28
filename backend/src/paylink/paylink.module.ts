import { BullModule, InjectQueue } from '@nestjs/bull';
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { EmailModule } from '../email/email.module';
import { Merchant } from '../merchants/entities/merchant.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SorobanModule } from '../soroban/soroban.module';
import { Transaction } from '../transactions/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { WsModule } from '../ws/ws.module';
import { PayLinkController } from './paylink.controller';
import { PayLink } from './entities/pay-link.entity';
import {
  EXPIRE_PAYLINKS_JOB,
  PAYLINK_QUEUE,
  PayLinkProcessor,
} from './paylink.processor';
import { PayLinkService } from './paylink.service';
import { PinModule } from '../pin/pin.module';
import { BalanceModule } from '../balance/balance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PayLink, User, Merchant, Transaction]),
    BullModule.registerQueue({ name: PAYLINK_QUEUE }),
    PinModule,
    SorobanModule,
    WsModule,
    EmailModule,
    NotificationsModule,
    BalanceModule,
  ],
  controllers: [PayLinkController],
  providers: [PayLinkService, PayLinkProcessor],
  exports: [PayLinkService],
})
export class PayLinkModule implements OnModuleInit {
  constructor(
    @InjectQueue(PAYLINK_QUEUE) private readonly payLinkQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.payLinkQueue.add(
      EXPIRE_PAYLINKS_JOB,
      {},
      {
        repeat: { every: 300_000 },
        jobId: 'expire-paylinks-every-5min',
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
