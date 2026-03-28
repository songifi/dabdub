import { BullModule, InjectQueue } from '@nestjs/bull';
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { SplitRequest } from './entities/split-request.entity';
import { SplitParticipant } from './entities/split-participant.entity';
import { SplitService, SPLIT_QUEUE, EXPIRE_SPLITS_JOB } from './split.service';
import { SplitController } from './split.controller';
import { SplitProcessor } from './split.processor';
import { UsersModule } from '../users/users.module';
import { TransfersModule } from '../transfers/transfers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SplitRequest, SplitParticipant]),
    BullModule.registerQueue({ name: SPLIT_QUEUE }),
    UsersModule,
    TransfersModule,
    NotificationsModule,
    EmailModule,
  ],
  providers: [SplitService, SplitProcessor],
  controllers: [SplitController],
  exports: [SplitService],
})
export class SplitsModule implements OnModuleInit {
  constructor(@InjectQueue(SPLIT_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      EXPIRE_SPLITS_JOB,
      {},
      {
        repeat: { every: 15 * 60 * 1000 },
        jobId: 'expire-splits-every-15min',
        removeOnComplete: true,
      },
    );
  }
}
