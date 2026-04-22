export interface FraudContext {
  /** Amount in USD */
  amount: number;

  /** 'transfer_out' | 'withdrawal' */
  txType: 'transfer_out' | 'withdrawal';

  /** ISO 3166-1 alpha-2 country code from the current request */
  requestCountry?: string;

  /** ISO 3166-1 alpha-2 country code from registration */
  registrationCountry?: string;

  /** Device token from the current request */
  deviceToken?: string;

  /** Current wallet balance in USD before this transaction */
  balanceBefore: number;

  /** Wallet balance after this transaction in USD */
  balanceAfter: number;

  /** UTC timestamp of the user's account creation */
  accountCreatedAt: Date;

  /** Whether this device token has been seen before for this user */
  isNewDevice?: boolean;
}
