import { DataSource } from 'typeorm';
import { Merchant } from '../merchants/entities/merchant.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Settlement } from '../settlements/entities/settlement.entity';
import { Webhook } from '../webhooks/entities/webhook.entity';
import { WaitlistEntry } from '../waitlist/entities/waitlist.entity';

export const TEST_ENTITIES = [Merchant, Payment, Settlement, Webhook, WaitlistEntry];

export async function createTestDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME_TEST ?? 'cheesepay_test',
    entities: TEST_ENTITIES,
    synchronize: true,
    logging: false,
  });
  await ds.initialize();
  return ds;
}

export async function truncateAll(dataSource: DataSource): Promise<void> {
  const tableNames = TEST_ENTITIES.map(
    (e) => dataSource.getMetadata(e).tableName,
  ).join('", "');
  await dataSource.query(`TRUNCATE TABLE "${tableNames}" RESTART IDENTITY CASCADE`);
}

export async function closeTestDataSource(dataSource: DataSource): Promise<void> {
  if (dataSource.isInitialized) await dataSource.destroy();
}
