import { registerAs } from '@nestjs/config';

export interface QueueConfig {
  bullBoardUsername: string;
  bullBoardPassword: string;
}

export const queueConfig = registerAs(
  'queue',
  (): QueueConfig => ({
    bullBoardUsername: process.env['BULL_BOARD_USERNAME']!,
    bullBoardPassword: process.env['BULL_BOARD_PASSWORD']!,
  }),
);
