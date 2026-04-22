import { FraudRule, RuleMatch, RuleDependencies } from './rule.interface';
import { FraudContext } from '../dto/fraud-context.dto';
import { FraudSeverity } from '../entities/fraud-flag.entity';

export class IpCountryMismatchRule implements FraudRule {
  async evaluate(
    userId: string,
    txId: string,
    context: FraudContext,
    _deps: RuleDependencies,
  ): Promise<RuleMatch | null> {
    if (!context.requestCountry || !context.registrationCountry) return null;

    if (
      context.requestCountry.toUpperCase() !==
      context.registrationCountry.toUpperCase()
    ) {
      return {
        rule: 'ip_country_mismatch',
        severity: FraudSeverity.LOW,
        description: `Request from country "${context.requestCountry}" does not match registration country "${context.registrationCountry}"`,
      };
    }

    return null;
  }
}
