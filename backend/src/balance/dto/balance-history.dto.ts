export class BalanceHistoryPoint {
  /** Date (ISO 8601) */
  date!: string;

  /** Liquid USDC balance */
  balanceUsdc!: string;

  /** Staked USDC balance */
  stakedBalanceUsdc!: string;

  /** Total USDC balance */
  totalUsdc!: string;
}

export class BalanceHistoryDto {
  /** 30 daily balance snapshots */
  points!: BalanceHistoryPoint[];
}
