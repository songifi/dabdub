import { FeatureFlag, FeatureFlagStatus } from '../entities/feature-flag.entity';
import { DataSource } from 'typeorm';

export const seedFeatureFlags = async (dataSource: DataSource): Promise<void> => {
  const repo = dataSource.getRepository(FeatureFlag);
  
  const flags = [
    {
      key: 'virtual_cards',
      description: 'Virtual cards feature',
      status: FeatureFlagStatus.DISABLED,
      percentage: null,
      enabledTiers: null,
      enabledUserIds: null,
      createdBy: 'system-seed',
    },
    {
      key: 'split_payments',
      description: 'Split payments feature',
      status: FeatureFlagStatus.ENABLED,
      percentage: null,
      enabledTiers: null,
      enabledUserIds: null,
      createdBy: 'system-seed',
    },
    {
      key: 'scheduled_payouts',
      description: 'Scheduled payouts feature',
      status: FeatureFlagStatus.PERCENTAGE,
      percentage: 20,
      enabledTiers: null,
      enabledUserIds: null,
      createdBy: 'system-seed',
    },
    {
      key: 'bulk_payments',
      description: 'Bulk payments feature',
      status: FeatureFlagStatus.TIER,
      percentage: null,
      enabledTiers: ['gold', 'black'],
      enabledUserIds: null,
      createdBy: 'system-seed',
    },
    {
      key: 'crypto_onramp',
      description: 'Crypto on-ramp feature',
      status: FeatureFlagStatus.ENABLED,
      percentage: null,
      enabledTiers: null,
      enabledUserIds: null,
      createdBy: 'system-seed',
    },
    {
      key: 'agent_chat',
      description: 'Agent chat feature',
      status: FeatureFlagStatus.PERCENTAGE,
      percentage: 50,
      enabledTiers: null,
      enabledUserIds: null,
      createdBy: 'system-seed',
    },
  ];

  for (const flagData of flags) {
    const existing = await repo.findOne({ where: { key: flagData.key } });
    if (!existing) {
      await repo.save(repo.create(flagData));
    }
  }
};
