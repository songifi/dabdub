import { registerAs } from '@nestjs/config';

export interface StellarConfig {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  adminSecretKey: string;
  /** Pooled classic Stellar address for USDC deposits (memo = username). */
  receiveAddress: string;
  /** Issuer of the USDC asset users receive on Stellar. */
  usdcIssuer: string;
}

export const stellarConfig = registerAs(
  'stellar',
  (): StellarConfig => ({
    rpcUrl: process.env['STELLAR_RPC_URL']!,
    networkPassphrase: process.env['STELLAR_NETWORK_PASSPHRASE']!,
    contractId: process.env['STELLAR_CONTRACT_ID']!,
    adminSecretKey: process.env['STELLAR_ADMIN_SECRET_KEY']!,
    receiveAddress: process.env['STELLAR_RECEIVE_ADDRESS']!,
    usdcIssuer: process.env['STELLAR_USDC_ISSUER']!,
  }),
);
