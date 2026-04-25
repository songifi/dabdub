import { createConnection, Connection } from 'typeorm';
import { Merchant } from '../merchants/entities/merchant.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Settlement } from '../settlements/entities/settlement.entity';
import { Webhook } from '../webhooks/entities/webhook.entity';
import { WaitlistEntry } from '../waitlist/entities/waitlist.entity';

export const TEST_ENTITIES = [Merchant, Payment, Settlement, Webhook, WaitlistEntry];

export async function createTestDataSource(): Promise<Connection> {
  return createConnection({
    name: `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASS ?? process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME_TEST ?? 'cheesepay_test',
    entities: TEST_ENTITIES,
    synchronize: true,
    logging: false,
  });
}

export async function truncateAll(conn: Connection | undefined): Promise<void> {
  if (!conn?.isConnected) return;
  const tableNames = TEST_ENTITIES.map((e) => conn.getMetadata(e).tableName).join('", "');
  await conn.query(`TRUNCATE TABLE "${tableNames}" RESTART IDENTITY CASCADE`);
}

export async function closeTestDataSource(conn: Connection): Promise<void> {
  if (conn.isConnected) await conn.close();
}
