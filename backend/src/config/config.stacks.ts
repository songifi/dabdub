import { registerAs } from '@nestjs/config';
import { StacksConfig } from './interfaces/config.interface';

export const stacksConfig = registerAs(
    'stacks',
    (): StacksConfig => ({
        activeNetwork: (process.env.STACKS_NETWORK as 'mainnet' | 'testnet') || 'testnet',
        networks: {
            testnet: {
                rpcUrl: process.env.STACKS_TESTNET_RPC_URL || 'https://api.testnet.hiro.so',
                network: 'testnet',
                usdcAssetIdentifier: process.env.STACKS_TESTNET_USDC_ASSET || 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.usd-token::usdc',
            },
            mainnet: {
                rpcUrl: process.env.STACKS_MAINNET_RPC_URL || 'https://api.mainnet.hiro.so',
                network: 'mainnet',
                usdcAssetIdentifier: process.env.STACKS_MAINNET_USDC_ASSET || 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YF86ZY.usdc-token::usdc',
            },
        },
    }),
);
