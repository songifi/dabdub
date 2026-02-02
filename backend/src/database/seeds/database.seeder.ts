import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { UserSeeder } from './user.seeder';
import { MerchantSeeder } from './merchant.seeder';
import { PaymentRequestSeeder } from './payment-request.seeder';
import { NetworkConfigSeeder } from './network-config.seeder';
import { ExchangeRateSeeder } from './exchange-rate.seeder';
import { SeedVersionSeeder } from './seed-version.seeder';

const SEED_VERSION = '1.0.0';

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

    // Create seed version tracking table
    await SeedVersionSeeder.createVersionTable(dataSource);
    console.log('');

    // Run seeders in order
    console.log('👤 Seeding users...');
    await UserSeeder.seed(dataSource);
    console.log('');

    console.log('🏪 Seeding merchants...');
    await MerchantSeeder.seed(dataSource);
    console.log('');

    console.log('🌐 Seeding network configurations...');
    await NetworkConfigSeeder.seed(dataSource);
    console.log('');

    console.log('💱 Seeding exchange rates...');
    await ExchangeRateSeeder.seed(dataSource);
    console.log('');

    console.log('💳 Seeding payment requests...');
    await PaymentRequestSeeder.seed(dataSource);
    console.log('');

    // Record seed version
    await SeedVersionSeeder.recordVersion(
      dataSource,
      SEED_VERSION,
      'Initial seed data with users, merchants, payment requests, network configs, and exchange rates',
    );

    console.log('✅ Database seeding completed successfully!');
    console.log(`📦 Seed version: ${SEED_VERSION}\n`);
    
    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runSeeds();
}

export { runSeeds };
