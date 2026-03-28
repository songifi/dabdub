import { Inject, Injectable } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { RequestHandler } from 'express';
import { queueConfig } from '../config/queue.config';
import type { QueueConfig } from '../config/queue.config';
import { BULL_BOARD_PATH } from './queue.constants';
import { QueueRegistryService } from './queue.registry';

@Injectable()
export class QueueBoardService {
  private readonly adapter = new ExpressAdapter();

  constructor(
    @Inject(queueConfig.KEY)
    private readonly config: QueueConfig,
    private readonly registry: QueueRegistryService,
  ) {
    this.adapter.setBasePath(BULL_BOARD_PATH);

    createBullBoard({
      queues: this.registry
        .getQueues()
        .map((queue) => new BullMQAdapter(queue)),
      serverAdapter: this.adapter,
    });
  }

  getRouter(): RequestHandler {
    return this.adapter.getRouter() as RequestHandler;
  }

  getCredentials(): { username: string; password: string } {
    return {
      username: this.config.bullBoardUsername,
      password: this.config.bullBoardPassword,
    };
  }
}
