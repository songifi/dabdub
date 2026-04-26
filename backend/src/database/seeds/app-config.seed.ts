import { DataSource } from 'typeorm';
import { AppConfig } from '../../app-config/entities/app-config.entity';

const DEFAULTS: Array<{ key: string; value: unknown; description: string }> = [
  { key: 'maintenance_mode',         value: false,   description: 'Put the app in maintenance mode' },
  { key: 'staking_enabled',          value: true,    description: 'Enable/disable staking features' },
  { key: 'fiat_settlement_enabled',  value: true,    description: 'Enable/disable fiat settlement' },
  { key: 'virtual_accounts_enabled', value: true,    description: 'Enable/disable virtual accounts' },
  { key: 'referral_reward_usdc',     value: '1.00',  description: 'USDC reward per referral' },
  { key: 'max_daily_deposit_usdc',   value: '10000', description: 'Max USDC deposit per user per day' },
];

export async function seedAppConfigs(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(AppConfig);
  for (const seed of DEFAULTS) {
    await repo.upsert(
      { key: seed.key, value: seed.value, description: seed.description },
      { conflictPaths: ['key'], skipUpdateIfNoValuesChanged: true },
    );
  }
  console.log('App configs seeded.');
}
