import { TierName } from '../tier-config/entities/tier-config.entity';
import {
  murmurBucketPercent,
  tierRolloutMatches,
} from './feature-flag.util';

describe('feature-flag.util', () => {
  describe('murmurBucketPercent', () => {
    it('is sticky for the same userId and key', () => {
      const a = murmurBucketPercent('user-1', 'scheduled_payouts');
      const b = murmurBucketPercent('user-1', 'scheduled_payouts');
      expect(a).toBe(b);
    });

    it('usually differs for different users', () => {
      const a = murmurBucketPercent('user-a', 'agent_chat');
      const b = murmurBucketPercent('user-b', 'agent_chat');
      expect(a).not.toBe(b);
    });
  });

  describe('tierRolloutMatches', () => {
    it('enables Gold and Black when tiers list is gold+black (hierarchy)', () => {
      expect(tierRolloutMatches(['gold', 'black'], TierName.SILVER)).toBe(
        false,
      );
      expect(tierRolloutMatches(['gold', 'black'], TierName.GOLD)).toBe(true);
      expect(tierRolloutMatches(['gold', 'black'], TierName.BLACK)).toBe(true);
    });

    it('enables only Black when list is black only', () => {
      expect(tierRolloutMatches(['black'], TierName.GOLD)).toBe(false);
      expect(tierRolloutMatches(['black'], TierName.BLACK)).toBe(true);
    });
  });
});
