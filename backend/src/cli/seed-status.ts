import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { SeedVersionSeeder } from '../database/seeds/seed-version.seeder';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD
    ? String(process.env.DB_PASSWORD).trim()
    : undefined,
  database: process.env.DB_NAME || 'dabdub_dev',
  entities: [path.join(__dirname, '/../database/**/*.entity.ts')],
  synchronize: false,
  logging: false,
});

(async () => {
  try {
    await dataSource.initialize();
    console.log('🌱 Seed Status\n');

    // Check if seed_versions table exists
    const tableExists = await dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'seed_versions'
      )
    `);

    if (!tableExists[0].exists) {
      console.log('⚠️  No seed versions found. Run seeds first.\n');
      await dataSource.destroy();
      return;
    }

    // Get all seed versions
    const versions = await SeedVersionSeeder.getAllVersions(dataSource);

    if (versions.length === 0) {
      console.log('⚠️  No seeds have been executed yet\n');
    } else {
      console.log('✅ Executed Seeds:');
      versions.forEach((version, index) => {
        console.log(
          `   ${index + 1}. v${version.version} - ${version.description}`,
        );
        console.log(
          `      Executed: ${new Date(version.executedAt).toLocaleString()}\n`,
        );
      });
    }

    // Get data counts
    const counts = await dataSource.query(`
      SELECT 
        'users' as table_name, COUNT(*) as count FROM users
      UNION ALL
      SELECT 'merchants', COUNT(*) FROM merchants
      UNION ALL
      SELECT 'payment_requests', COUNT(*) FROM payment_requests
      UNION ALL
      SELECT 'settlements', COUNT(*) FROM settlements
      UNION ALL
      SELECT 'wallets', COUNT(*) FROM wallets
    `);

    console.log('📊 Data Summary:');
    counts.forEach((row: any) => {
      console.log(`   • ${row.table_name}: ${row.count} records`);
    });

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Failed to get seed status:', error);
    process.exit(1);
  }
})();
