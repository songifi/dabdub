/**
 * Centralized Redis key naming conventions.
 * All keys are used with the configured keyPrefix (e.g. dabdub:).
 */
export const RedisKeys = {
  // Auth
  refreshToken: (adminId: string, tokenId: string) =>
    `auth:refresh:${adminId}:${tokenId}`,
  adminSessions: (adminId: string) => `auth:sessions:${adminId}`,
  loginAttempts: (email: string) => `auth:attempts:${email}`,
  accountLockout: (email: string) => `auth:lockout:${email}`,

  // Cache
  merchantList: (hash: string) => `cache:merchants:${hash}`,
  merchantDetail: (id: string) => `cache:merchant:${id}`,
  dashboardOverview: (period: string) => `cache:dashboard:overview:${period}`,
  dashboardAlertThresholds: () => 'dashboard:alert_thresholds',

  // Rate limiting
  rateLimit: (key: string) => `ratelimit:${key}`,

  // Security
  ipBlocks: () => 'security:ip_blocks',
  ipBlock: (cidr: string) => `security:ip_block:${cidr}`,
  merchantIpAllowlist: (merchantId: string) => `security:merchant_ip_allowlist:${merchantId}`,
};
