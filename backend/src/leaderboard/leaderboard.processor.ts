import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardGateway } from './leaderboard.gateway';

export const LEADERBOARD_QUEUE = 'leaderboard';
export const BROADCAST_JOB = 'broadcast-top10';

@Processor(LEADERBOARD_QUEUE)
export class LeaderboardProcessor {
  private readonly logger = new Logger(LeaderboardProcessor.name);

  constructor(
    private readonly leaderboardService: LeaderboardService,
    private readonly leaderboardGateway: LeaderboardGateway,
  ) {}

  @Process(BROADCAST_JOB)
  async handleBroadcast(job: Job<{ namespace: string }>): Promise<void> {
    const namespace = job.data?.namespace ?? 'users';
    try {
      const top10 = await this.leaderboardService.getTopN(10, namespace);
      this.leaderboardGateway.emitRankChanged(top10);
      this.logger.debug(`Broadcasted top 10 for namespace "${namespace}"`);
    } catch (err) {
      this.logger.error(
        `Broadcast job failed for namespace "${namespace}"`,
        err,
      );
      throw err;
    }
  }
}
