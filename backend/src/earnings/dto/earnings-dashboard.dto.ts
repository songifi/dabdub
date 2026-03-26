export class EarningsDashboardDto {
  stakedBalanceUsdc!: string;
  liquidBalanceUsdc!: string;
  currentApyPercent!: string;
  totalYieldEarnedUsdc!: string;
  projectedDailyYieldUsdc!: string;
  projectedMonthlyYieldUsdc!: string;
  stakeLockupDays!: number;
  canUnstakeNow!: boolean;
  nextUnstakeDate!: string | null;
}
