/**
 * Deep link scheme and pattern registry for the Cheese PWA.
 * All deep links use the `cheesewallet://` custom URL scheme.
 * Web fallback uses HTTPS universal links via pay.cheesepay.xyz.
 */

export const DEEP_LINK_SCHEME = 'cheesewallet://';
export const WEB_FALLBACK_BASE = 'https://pay.cheesepay.xyz';

export enum DeepLinkType {
  PAY = 'pay',
  PAYLINK = 'paylink',
  PROFILE = 'profile',
  ACTIVITY = 'activity',
  INVITE = 'invite',
  KYC = 'kyc',
  EARN = 'earn',
}

export interface DeepLinkPatterns {
  /** cheesewallet://pay?to={username}&amount={optional} → Send screen prefilled */
  [DeepLinkType.PAY]: { to: string; amount?: string };
  /** cheesewallet://paylink?id={tokenId} → PayLink pay screen */
  [DeepLinkType.PAYLINK]: { id: string };
  /** cheesewallet://profile/{username} → User profile */
  [DeepLinkType.PROFILE]: { username: string };
  /** cheesewallet://activity/{txId} → Transaction detail */
  [DeepLinkType.ACTIVITY]: { txId: string };
  /** cheesewallet://invite?ref={code} → Registration with referral code */
  [DeepLinkType.INVITE]: { ref: string };
  /** cheesewallet://kyc → KYC submission screen (no params) */
  [DeepLinkType.KYC]: Record<string, never>;
  /** cheesewallet://earn → Staking screen (no params) */
  [DeepLinkType.EARN]: Record<string, never>;
}
