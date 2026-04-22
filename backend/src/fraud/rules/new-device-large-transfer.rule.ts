import { FraudRule, RuleMatch, RuleDependencies } from './rule.interface';
import { FraudContext } from '../dto/fraud-context.dto';
import { FraudSeverity } from '../entities/fraud-flag.entity';

const AMOUNT_THRESHOLD = 100;

export class NewDeviceLargeTransferRule implements FraudRule {
  async evaluate(
    userId: string,
    txId: string,
    context: FraudContext,
    _deps: RuleDependencies,
  ): Promise<RuleMatch | null> {
    if (!context.isNewDevice) return null;
    if (context.txType !== 'transfer_out') return null;
    if (context.amount <= AMOUNT_THRESHOLD) return null;

    return {
      rule: 'new_device_large_transfer',
      severity: FraudSeverity.MEDIUM,
      description: `Transfer of $${context.amount} from an unrecognised device token`,
    };
  }
}
