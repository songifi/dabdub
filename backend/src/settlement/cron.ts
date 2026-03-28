// backend/src/modules/settlement/cron.ts
import { Queue } from 'bullmq';

const settlementQueue = new Queue('settlement-tasks');

// Schedule every 15 minutes
await settlementQueue.add(
  'cron-check-merchants',
  {},
  { repeat: { pattern: '*/15 * * * *' } }
);
