import { FraudContext } from '../dto/fraud-context.dto';
import { FraudSeverity } from '../entities/fraud-flag.entity';

export interface RuleMatch {
  rule: string;
  severity: FraudSeverity;
  description: string;
}

export interface FraudRule {
  evaluate(
    userId: string,
    txId: string,
    context: FraudContext,
    // injected deps passed from FraudService
    deps: RuleDependencies,
  ): Promise<RuleMatch | null>;
}

export interface RuleDependencies {
  /** Count transfer_out events for userId in the last `windowMs` milliseconds */
  countRecentTransfers(userId: string, windowMs: number): Promise<number>;
  /** Get the user's first-ever transaction date; null if none */
  getFirstTransactionDate(userId: string): Promise<Date | null>;
}
