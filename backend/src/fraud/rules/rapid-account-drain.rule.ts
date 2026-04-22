import { FraudRule, RuleMatch, RuleDependencies } from './rule.interface';
import { FraudContext } from '../dto/fraud-context.dto';
import { FraudSeverity } from '../entities/fraud-flag.entity';

const DRAIN_THRESHOLD = 0.9; // 90%

export class RapidAccountDrainRule implements FraudRule {
  async evaluate(
    userId: string,
    txId: string,
    context: FraudContext,
    _deps: RuleDependencies,
  ): Promise<RuleMatch | null> {
    if (context.balanceBefore <= 0) return null;

    const drop =
      (context.balanceBefore - context.balanceAfter) / context.balanceBefore;

    if (drop >= DRAIN_THRESHOLD) {
      const dropPct = (drop * 100).toFixed(1);
      return {
        rule: 'rapid_account_drain',
        severity: FraudSeverity.HIGH,
        description: `Balance dropped ${dropPct}% in a single transaction (before: $${context.balanceBefore}, after: $${context.balanceAfter})`,
      };
    }

    return null;
  }
}
