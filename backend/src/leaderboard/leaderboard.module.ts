import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardGateway } from './leaderboard.gateway';
import {
  LeaderboardProcessor,
  LEADERBOARD_QUEUE,
  BROADCAST_JOB,
} from './leaderboard.processor';

@Module({
  imports: [BullModule.registerQueue({ name: LEADERBOARD_QUEUE })],
  providers: [LeaderboardService, LeaderboardGateway, LeaderboardProcessor],
  controllers: [LeaderboardController],
  exports: [LeaderboardService],
})
export class LeaderboardModule implements OnModuleInit {
  constructor(
    @InjectQueue(LEADERBOARD_QUEUE) private readonly leaderboardQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Register repeatable job: broadcast top 10 every 60 seconds.
    await this.leaderboardQueue.add(
      BROADCAST_JOB,
      { namespace: 'users' },
      {
        repeat: { every: 60_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    await this.leaderboardQueue.add(
      BROADCAST_JOB,
      { namespace: 'waitlist' },
      {
        repeat: { every: 60_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
