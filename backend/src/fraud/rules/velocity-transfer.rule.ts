import { FraudRule, RuleMatch, RuleDependencies } from './rule.interface';
import { FraudContext } from '../dto/fraud-context.dto';
import { FraudSeverity } from '../entities/fraud-flag.entity';

export class VelocityTransferRule implements FraudRule {
  private static readonly WINDOW_MS = 60 * 60 * 1000; // 1 hour
  private static readonly THRESHOLD = 5;

  async evaluate(
    userId: string,
    txId: string,
    context: FraudContext,
    deps: RuleDependencies,
  ): Promise<RuleMatch | null> {
    if (context.txType !== 'transfer_out') return null;

    const count = await deps.countRecentTransfers(
      userId,
      VelocityTransferRule.WINDOW_MS,
    );

    // count includes the current tx; flag when it exceeds threshold (i.e. 6th transfer)
    if (count > VelocityTransferRule.THRESHOLD) {
      return {
        rule: 'velocity.transfer',
        severity: FraudSeverity.MEDIUM,
        description: `${count} outbound transfers in the last hour (threshold: ${VelocityTransferRule.THRESHOLD})`,
      };
    }

    return null;
  }
}
