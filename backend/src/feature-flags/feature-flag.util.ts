import MurmurHash3 from 'imurmurhash';
import { TierName } from '../tier-config/entities/tier-config.entity';

const TIER_RANK: Record<string, number> = {
  silver: 0,
  gold: 1,
  black: 2,
};

/** Sticky bucket in [0, 99] from userId + flag key (MurmurHash3). */
export function murmurBucketPercent(userId: string, key: string): number {
  const h = MurmurHash3();
  h.hash(userId + key);
  return (h.result() >>> 0) % 100;
}

export function userTierRank(tier: TierName): number {
  const k = String(tier).toLowerCase();
  return TIER_RANK[k] ?? -1;
}

/**
 * User is in rollout if their tier rank is at or above the lowest tier listed
 * (e.g. ["Gold","Black"] enables Gold and Black; Silver is excluded).
 */
export function tierRolloutMatches(
  enabledTiers: string[] | null | undefined,
  userTier: TierName,
): boolean {
  if (!enabledTiers?.length) return false;
  const userR = userTierRank(userTier);
  const requiredRanks = enabledTiers.map(
    (t) => TIER_RANK[t.trim().toLowerCase()] ?? 999,
  );
  const minRequired = Math.min(...requiredRanks);
  return userR >= minRequired;
}
