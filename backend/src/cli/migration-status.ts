import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';

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
  migrations: [path.join(__dirname, '/../database/migrations/*.ts')],
  synchronize: false,
  logging: false,
});

(async () => {
  try {
    await dataSource.initialize();
    console.log('📊 Migration Status\n');

    // Get executed migrations
    const executedMigrations = await dataSource.query(
      `SELECT * FROM migrations ORDER BY timestamp DESC`,
    );

    // Get pending migrations
    const pendingMigrations = await dataSource.showMigrations();

    console.log('✅ Executed Migrations:');
    if (executedMigrations.length === 0) {
      console.log('   No migrations executed yet\n');
    } else {
      executedMigrations.forEach((migration: any, index: number) => {
        console.log(
          `   ${index + 1}. ${migration.name} (${new Date(migration.timestamp).toLocaleString()})`,
        );
      });
      console.log('');
    }

    console.log('⏳ Pending Migrations:');
    if (!pendingMigrations) {
      console.log('   All migrations are up to date\n');
    } else {
      console.log('   There are pending migrations to run\n');
    }

    // Get table information
    const tables = await dataSource.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('📋 Database Tables:');
    tables.forEach((table: any) => {
      console.log(`   • ${table.table_name} (${table.column_count} columns)`);
    });

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Failed to get migration status:', error);
    process.exit(1);
  }
})();
