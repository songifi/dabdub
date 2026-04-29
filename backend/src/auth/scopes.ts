export type ApiScope =
  | 'payments:read'
  | 'payments:write'
  | 'settlements:read'
  | 'webhooks:manage';

export const API_KEY_SCOPES: ApiScope[] = [
  'payments:read',
  'payments:write',
  'settlements:read',
  'webhooks:manage',
];
