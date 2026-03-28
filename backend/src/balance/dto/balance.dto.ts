export class BalanceDto {
  /** Liquid USDC balance (from blockchain wallet) */
  balanceUsdc!: string;

  /** Staked USDC balance (from blockchain wallet) */
  stakedBalanceUsdc!: string;

  /** Total USDC balance (liquid + staked) */
  totalUsdc!: string;

  /** NGN equivalent of liquid balance at current rate */
  balanceNgn!: string;

  /** NGN equivalent of staked balance at current rate */
  stakedBalanceNgn!: string;

  /** Current USDC/NGN exchange rate */
  rate!: string;

  /** Last time the balance was synced from blockchain */
  lastSyncedAt!: string;

  /** 24h balance change (null if no transactions in last 24h) */
  change24h!: string | null;
}
