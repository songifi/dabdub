import { AppDataSource } from '../data-source';
import { seedTierConfigs } from './tier-config.seed';
import { seedAppConfigs } from './app-config.seed';

async function runSeeds(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Running seeds...');

  await seedTierConfigs(AppDataSource);
  await seedAppConfigs(AppDataSource);

  await AppDataSource.destroy();
  console.log('Seeds complete.');
}

runSeeds().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
