export interface VsLastPeriodTransaction {
  total: string;
  totalVolumeUsd: string;
}

export interface VsLastPeriodMerchant {
  newThisPeriod: string;
}

export interface VsLastPeriodFees {
  collectedUsd: string;
}

export interface DashboardTransactionsDto {
  total: number;
  totalVolumeUsd: string;
  successRate: string;
  failed: number;
  pendingConfirmation: number;
  pendingSettlement: number;
  vsLastPeriod: VsLastPeriodTransaction;
}

export interface DashboardMerchantsDto {
  total: number;
  active: number;
  pendingKyc: number;
  suspended: number;
  newThisPeriod: number;
  vsLastPeriod: VsLastPeriodMerchant;
}

export interface DashboardSettlementsDto {
  completedCount: number;
  completedVolumeUsd: string;
  failedCount: number;
  pendingCount: number;
  pendingVolumeUsd: string;
}

export interface DashboardFeesDto {
  collectedUsd: string;
  vsLastPeriod: VsLastPeriodFees;
}

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface DashboardAlertDto {
  type: string;
  severity: AlertSeverity;
  message: string;
  since: string;
}

export interface DashboardOverviewResponseDto {
  period: string;
  generatedAt: string;
  transactions: DashboardTransactionsDto;
  merchants: DashboardMerchantsDto;
  settlements: DashboardSettlementsDto;
  fees: DashboardFeesDto;
  alerts: DashboardAlertDto[];
}
