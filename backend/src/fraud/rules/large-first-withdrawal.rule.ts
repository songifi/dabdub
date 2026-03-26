
import { FraudRule, RuleMatch, RuleDependencies } from './rule.interface';
import { FraudContext } from '../dto/fraud-context.dto';
import { FraudSeverity } from '../entities/fraud-flag.entity';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const AMOUNT_THRESHOLD = 200;

export class LargeFirstWithdrawalRule implements FraudRule {
  async evaluate(
    userId: string,
    txId: string,
    context: FraudContext,
    deps: RuleDependencies,
  ): Promise<RuleMatch | null> {
    if (context.txType !== 'withdrawal') return null;
    if (context.amount <= AMOUNT_THRESHOLD) return null;

    const accountAgeMs = Date.now() - context.accountCreatedAt.getTime();
    if (accountAgeMs > SEVEN_DAYS_MS) return null;

    return {
      rule: 'large_first_withdrawal',
      severity: FraudSeverity.HIGH,
      description: `Withdrawal of $${context.amount} within first 7 days of account creation`,
    };
  }
}
