import { DataSource } from 'typeorm';
import { TierConfig, TierName } from '../../tier-config/entities/tier-config.entity';

export async function seedTierConfigs(dataSource: DataSource): Promise<void> {
  const tierRepo = dataSource.getRepository(TierConfig);

  const tiers = [
    {
      tier: TierName.SILVER,
      dailyTransferLimitUsdc: '50',
      monthlyTransferLimitUsdc: '500',
      maxSingleWithdrawalUsdc: '50',
      feeDiscountPercent: 0,
      yieldApyPercent: '3.00',
      minStakeAmountUsdc: '0',
      stakeLockupDays: 0,
    },
    {
      tier: TierName.GOLD,
      dailyTransferLimitUsdc: '500',
      monthlyTransferLimitUsdc: '5000',
      maxSingleWithdrawalUsdc: '500',
      feeDiscountPercent: 20,
      yieldApyPercent: '7.00',
      minStakeAmountUsdc: '10',
      stakeLockupDays: 7,
    },
    {
      tier: TierName.BLACK,
      dailyTransferLimitUsdc: '5000',
      monthlyTransferLimitUsdc: '50000',
      maxSingleWithdrawalUsdc: '5000',
      feeDiscountPercent: 50,
      yieldApyPercent: '12.00',
      minStakeAmountUsdc: '100',
      stakeLockupDays: 0,
    },
  ];

  for (const t of tiers) {
    const existing = await tierRepo.findOne({ where: { tier: t.tier } });
    if (existing) {
      Object.assign(existing, t);
      await tierRepo.save(existing);
    } else {
      await tierRepo.save(tierRepo.create(t));
    }
  }

  console.log('Tier configurations seeded.');
}
