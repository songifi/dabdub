/**
 * Supported chain identifiers for POST /payments.
 * Must match SUPPORTED_CHAINS in evm.constants (lowercase keys).
 */
export const SUPPORTED_CHAINS = [
  'polygon',
  'base',
  'celo',
  'arbitrum',
  'optimism',
] as const;

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

export function isSupportedChain(chain: string): chain is SupportedChain {
  return (SUPPORTED_CHAINS as readonly string[]).includes(chain);
}
