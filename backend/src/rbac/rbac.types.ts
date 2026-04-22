export enum Role {
  User = 'user',
  Merchant = 'merchant',
  Admin = 'admin',
  SuperAdmin = 'super_admin',
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.User]: 0,
  [Role.Merchant]: 1,
  [Role.Admin]: 2,
  [Role.SuperAdmin]: 3,
};

export enum Permission {
  KycReview = 'kyc.review',
  FeeManage = 'fee.manage',
  UserFreeze = 'user.freeze',
  TierManage = 'tier.manage',
  ConfigManage = 'config.manage',
  ReportExport = 'report.export',
  BroadcastSend = 'broadcast.send',
  ComplianceReview = 'compliance.review',
}

