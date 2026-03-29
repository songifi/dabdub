import { DataSource } from 'typeorm';
import {
  FeatureFlag,
  FeatureFlagStatus,
} from '../../feature-flags/entities/feature-flag.entity';

const DEFAULT_FLAGS: Array<
  Pick<
    FeatureFlag,
    | 'key'
    | 'description'
    | 'status'
    | 'percentage'
    | 'enabledTiers'
    | 'enabledUserIds'
  >
> = [
  {
    key: 'virtual_cards',
    description: 'Virtual card issuance and management',
    status: FeatureFlagStatus.DISABLED,
    percentage: null,
    enabledTiers: null,
    enabledUserIds: null,
  },
  {
    key: 'split_payments',
    description: 'Split payment requests between users',
    status: FeatureFlagStatus.ENABLED,
    percentage: null,
    enabledTiers: null,
    enabledUserIds: null,
  },
  {
    key: 'scheduled_payouts',
    description: 'Schedule future payouts',
    status: FeatureFlagStatus.PERCENTAGE,
    percentage: 20,
    enabledTiers: null,
    enabledUserIds: null,
  },
  {
    key: 'bulk_payments',
    description: 'Bulk payment batches',
    status: FeatureFlagStatus.TIER,
    percentage: null,
    enabledTiers: ['gold', 'black'],
    enabledUserIds: null,
  },
  {
    key: 'crypto_onramp',
    description: 'Crypto on-ramp flows',
    status: FeatureFlagStatus.ENABLED,
    percentage: null,
    enabledTiers: null,
    enabledUserIds: null,
  },
  {
    key: 'agent_chat',
    description: 'In-app agent / support chat',
    status: FeatureFlagStatus.PERCENTAGE,
    percentage: 50,
    enabledTiers: null,
    enabledUserIds: null,
  },
];

export async function seedFeatureFlags(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(FeatureFlag);

  for (const def of DEFAULT_FLAGS) {
    const existing = await repo.findOne({ where: { key: def.key } });
    if (existing) continue;

    await repo.save(
      repo.create({
        ...def,
        createdBy: null,
      }),
    );
  }
}
