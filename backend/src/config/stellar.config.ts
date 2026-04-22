import { registerAs } from '@nestjs/config';

export interface StellarConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  adminSecretKey: string;
}

export const stellarConfig = registerAs(
  'stellar',
  (): StellarConfig => ({
    rpcUrl: process.env['STELLAR_RPC_URL']!,
    networkPassphrase: process.env['STELLAR_NETWORK_PASSPHRASE']!,
    contractId: process.env['STELLAR_CONTRACT_ID']!,
    adminSecretKey: process.env['STELLAR_ADMIN_SECRET_KEY']!,
  }),
);
