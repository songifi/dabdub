import {
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  IsNumber,
  Min,
} from 'class-validator';
import { OnboardingStepKey } from '../entities/merchant-onboarding-progress.entity';

export class OnboardingFunnelStatsDto {
  step: OnboardingStepKey;
  count: number;
  dropoffCount: number;
  dropoffRate: string;
}

export class OnboardingFunnelResponseDto {
  funnel: { [key in OnboardingStepKey]: Omit<OnboardingFunnelStatsDto, 'step'> };
  stuckMerchants: number;
  averageDaysToActivation: number;
  conversionRate: string;
}

export class OnboardingMerchantListDto {
  merchantId: string;
  merchantName: string;
  completionPercentage: string;
  completedStepCount: number;
  totalStepCount: number;
  currentStep: OnboardingStepKey | null;
  daysInCurrentStep: number | null;
  isStuck: boolean;
  lastProgressAt: Date | null;
  createdAt: Date;
}

export class OnboardingMerchantDetailDto {
  merchantId: string;
  merchantName: string;
  merchantEmail: string;
  completionPercentage: string;
  completedStepCount: number;
  totalStepCount: number;
  isStuck: boolean;
  steps: {
    key: OnboardingStepKey;
    status: string;
    completedAt: Date | null;
    blockedReason: string | null;
  }[];
  lastProgressAt: Date | null;
  daysInCurrentStep: number | null;
}

export class OnboardingNudgeRequestDto {
  @IsOptional()
  @IsString()
  customMessage?: string;
}

export class OnboardingSkipStepRequestDto {
  @IsEnum([
    'ACCOUNT_CREATED',
    'EMAIL_VERIFIED',
    'BUSINESS_PROFILE_COMPLETE',
    'KYC_SUBMITTED',
    'KYC_APPROVED',
    'BANK_ACCOUNT_LINKED',
    'API_KEY_GENERATED',
    'FIRST_TRANSACTION',
    'FIRST_SETTLEMENT',
  ])
  step: OnboardingStepKey;

  @IsString()
  @MinLength(5)
  reason: string;
}

export class OnboardingMetricsDto {
  last30d: {
    newSignups: number;
    activatedCount: number;
    activationRate: string;
    averageDaysToActivation: number;
    stuckCount: number;
    nudgesSent: number;
    nudgeConversionRate: string;
  };
}

export class OnboardingListQueryDto {
  @IsOptional()
  @IsEnum([
    'ACCOUNT_CREATED',
    'EMAIL_VERIFIED',
    'BUSINESS_PROFILE_COMPLETE',
    'KYC_SUBMITTED',
    'KYC_APPROVED',
    'BANK_ACCOUNT_LINKED',
    'API_KEY_GENERATED',
    'FIRST_TRANSACTION',
    'FIRST_SETTLEMENT',
  ])
  currentStep?: OnboardingStepKey;

  @IsOptional()
  isStuck?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minDaysInCurrentStep?: number;

  @IsOptional()
  createdAfter?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;
}
