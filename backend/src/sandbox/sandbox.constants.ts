export const SANDBOX_BALANCE_INITIAL_USDC = 10_000;
export const SANDBOX_CURRENCY = 'USDC';

export function sandboxBalanceKey(
  merchantId: string,
  currency: string = SANDBOX_CURRENCY,
): string {
  return `sandbox:balance:${merchantId}:${currency}`;
}

export function sandboxTransactionsKey(merchantId: string): string {
  return `sandbox:transactions:${merchantId}`;
}
