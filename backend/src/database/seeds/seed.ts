import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { AdminUserSeeder } from './admin-user.seed';
import { RolesSeeder } from './roles.seed';
import { UserSeeder } from './user.seeder';
import { MerchantSeeder } from './merchant.seeder';
import { NetworkConfigSeeder } from './network-config.seeder';
import { ExchangeRateSeeder } from './exchange-rate.seeder';
import { SeedVersionSeeder } from './seed-version.seeder';

const SEED_VERSION = '2.0.0';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD
    ? String(process.env.DB_PASSWORD).trim()
    : undefined,
  database: process.env.DB_NAME || 'dabdub_dev',
  entities: [path.join(__dirname, '/../**/*.entity.ts')],
  synchronize: false,
  logging: false,
});

async function runSeeds() {
  try {
    console.log('🌱 Starting database seeding...\n');

    await dataSource.initialize();
    console.log('✓ Database connection established\n');

    await SeedVersionSeeder.createVersionTable(dataSource);

    console.log('🔐 Seeding bootstrap admin...');
    await AdminUserSeeder.seed(dataSource);

    console.log('\n🎭 Seeding roles and permissions...');
    await RolesSeeder.seed(dataSource);

    console.log('\n👤 Seeding users...');
    await UserSeeder.seed(dataSource);

    console.log('\n🏪 Seeding merchants...');
    await MerchantSeeder.seed(dataSource);

    console.log('\n🌐 Seeding network configurations...');
    await NetworkConfigSeeder.seed(dataSource);

    console.log('\n💱 Seeding exchange rates...');
    await ExchangeRateSeeder.seed(dataSource);

    await SeedVersionSeeder.recordVersion(
      dataSource,
      SEED_VERSION,
      'Added super admin bootstrap and roles/permissions seeding',
    );

    console.log('\n✅ Database seeding completed successfully!');
    console.log(`📦 Seed version: ${SEED_VERSION}\n`);

    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    await dataSource.destroy().catch(() => null);
    process.exit(1);
  }
}

if (require.main === module) {
  runSeeds();
}

export { runSeeds };
