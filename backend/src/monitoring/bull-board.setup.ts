import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import type { Queue } from 'bull';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Express } from 'express';
import { MONITORED_BULL_QUEUES } from './queue.constants';
import { bullBoardBasicAuthMiddleware } from './bull-board-auth.middleware';

/**
 * Mounts Bull Board UI at `/admin/queues` (outside API prefix).
 * Requires `BULL_BOARD_USER` and `BULL_BOARD_PASSWORD` in the environment.
 */
export function mountBullBoard(app: INestApplication): void {
  const user = process.env['BULL_BOARD_USER'];
  const password = process.env['BULL_BOARD_PASSWORD'];
  const logger = new Logger('BullBoard');

  if (!user || !password) {
    logger.log('Bull Board disabled — set BULL_BOARD_USER and BULL_BOARD_PASSWORD');
    return;
  }

  const adapters: BullAdapter[] = [];
  for (const name of MONITORED_BULL_QUEUES) {
    const q = app.get<Queue>(getQueueToken(name), { strict: false });
    if (q) adapters.push(new BullAdapter(q));
  }

  if (adapters.length === 0) {
    logger.warn('Bull Board: no Bull queues resolved');
    return;
  }

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  createBullBoard({ queues: adapters, serverAdapter });

  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.use(
    '/admin/queues',
    bullBoardBasicAuthMiddleware(user, password),
    serverAdapter.getRouter(),
  );

  logger.log('Bull Board mounted at /admin/queues (HTTP Basic auth)');
}
