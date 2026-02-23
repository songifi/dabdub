import { DataSource } from 'typeorm';

export interface NetworkConfig {
  network: string;
  rpcUrl: string;
  chainId: number;
  isActive: boolean;
  requiredConfirmations: number;
  fallbackRpcUrls?: string[];
  networkSettings?: Record<string, unknown>;
  supportsEIP1559?: boolean;
  supportsFlashbots?: boolean;
  supportsERC20?: boolean;
}

export class NetworkConfigSeeder {
  static async seed(dataSource: DataSource): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();

    // Create network_configs table if it doesn't exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS network_configs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        network VARCHAR(50) NOT NULL UNIQUE,
        rpc_url TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        is_active BOOLEAN DEFAULT true,
        block_time INTEGER NULL,
        status VARCHAR(30) DEFAULT 'active',
        usdc_contract_address VARCHAR(255) NULL,
        settlement_contract_address VARCHAR(255) NULL,
        required_confirmations INTEGER DEFAULT 12,
        current_gas_price DECIMAL(20, 8) NULL,
        max_gas_price DECIMAL(20, 8) NULL,
        last_block_number INTEGER NULL,
        last_health_check TIMESTAMP NULL,
        is_healthy BOOLEAN DEFAULT true,
        fallback_rpc_urls TEXT NULL,
        last_scanned_block INTEGER NULL,
        base_fee_per_gas DECIMAL(20, 8) NULL,
        priority_fee_per_gas DECIMAL(20, 8) NULL,
        network_settings JSONB NULL,
        supports_eip1559 BOOLEAN DEFAULT false,
        supports_flashbots BOOLEAN DEFAULT false,
        supports_erc20 BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_network_config_status
          CHECK (status IN ('active', 'maintenance', 'deprecated'))
      )
    `);

    const networks = [
      {
        network: 'ethereum',
        rpc_url: 'https://eth.llamarpc.com',
        chain_id: 1,
        network_settings: JSON.stringify({
          name: 'Ethereum Mainnet',
          blockExplorer: 'https://etherscan.io',
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
        }),
        fallback_rpc_urls:
          'https://rpc.ankr.com/eth,https://ethereum.publicnode.com',
        required_confirmations: 12,
        supports_eip1559: true,
        supports_flashbots: true,
        supports_erc20: true,
        is_active: true,
      },
      {
        network: 'polygon',
        rpc_url: 'https://polygon-rpc.com',
        chain_id: 137,
        network_settings: JSON.stringify({
          name: 'Polygon Mainnet',
          blockExplorer: 'https://polygonscan.com',
          nativeCurrency: {
            name: 'MATIC',
            symbol: 'MATIC',
            decimals: 18,
          },
        }),
        fallback_rpc_urls:
          'https://rpc-mainnet.maticvigil.com,https://polygon-bor-rpc.publicnode.com',
        required_confirmations: 64,
        supports_eip1559: true,
        supports_flashbots: false,
        supports_erc20: true,
        is_active: true,
      },
      {
        network: 'stellar-testnet',
        rpc_url: 'https://horizon-testnet.stellar.org',
        chain_id: 0,
        network_settings: JSON.stringify({
          name: 'Stellar Testnet',
          blockExplorer: 'https://stellar.expert/explorer/testnet',
          nativeCurrency: {
            name: 'Stellar Lumens',
            symbol: 'XLM',
            decimals: 7,
          },
        }),
        fallback_rpc_urls: 'https://horizon-testnet.stellar.lobstr.co',
        required_confirmations: 1,
        supports_eip1559: false,
        supports_flashbots: false,
        supports_erc20: false,
        is_active: true,
      },
      {
        network: 'stellar-mainnet',
        rpc_url: 'https://horizon.stellar.org',
        chain_id: 0,
        network_settings: JSON.stringify({
          name: 'Stellar Mainnet',
          blockExplorer: 'https://stellar.expert/explorer/public',
          nativeCurrency: {
            name: 'Stellar Lumens',
            symbol: 'XLM',
            decimals: 7,
          },
        }),
        fallback_rpc_urls: 'https://horizon.stellar.lobstr.co',
        required_confirmations: 1,
        supports_eip1559: false,
        supports_flashbots: false,
        supports_erc20: false,
        is_active: true,
      },
      {
        network: 'base',
        rpc_url: 'https://mainnet.base.org',
        chain_id: 8453,
        network_settings: JSON.stringify({
          name: 'Base Mainnet',
          blockExplorer: 'https://basescan.org',
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
        }),
        fallback_rpc_urls:
          'https://base-rpc.publicnode.com,https://1rpc.io/base',
        required_confirmations: 12,
        supports_eip1559: true,
        supports_flashbots: true,
        supports_erc20: true,
        is_active: true,
      },
      {
        network: 'arbitrum',
        rpc_url: 'https://arb1.arbitrum.io/rpc',
        chain_id: 42161,
        network_settings: JSON.stringify({
          name: 'Arbitrum One',
          blockExplorer: 'https://arbiscan.io',
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
        }),
        fallback_rpc_urls:
          'https://rpc.ankr.com/arbitrum,https://arbitrum-one-rpc.publicnode.com',
        required_confirmations: 20,
        supports_eip1559: true,
        supports_flashbots: true,
        supports_erc20: true,
        is_active: true,
      },
      {
        network: 'optimism',
        rpc_url: 'https://mainnet.optimism.io',
        chain_id: 10,
        network_settings: JSON.stringify({
          name: 'Optimism',
          blockExplorer: 'https://optimistic.etherscan.io',
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18,
          },
        }),
        fallback_rpc_urls:
          'https://optimism.publicnode.com,https://rpc.ankr.com/optimism',
        required_confirmations: 12,
        supports_eip1559: true,
        supports_flashbots: false,
        supports_erc20: true,
        is_active: true,
      },
      {
        network: 'bsc',
        rpc_url: 'https://bsc-dataseed.binance.org',
        chain_id: 56,
        network_settings: JSON.stringify({
          name: 'BNB Smart Chain',
          blockExplorer: 'https://bscscan.com',
          nativeCurrency: {
            name: 'BNB',
            symbol: 'BNB',
            decimals: 18,
          },
        }),
        fallback_rpc_urls:
          'https://rpc.ankr.com/bsc,https://bsc.publicnode.com',
        required_confirmations: 15,
        supports_eip1559: false,
        supports_flashbots: false,
        supports_erc20: true,
        is_active: true,
      },
    ];

    for (const network of networks) {
      const exists = await queryRunner.query(
        `SELECT id FROM network_configs WHERE network = $1`,
        [network.network],
      );

      if (exists.length === 0) {
        await queryRunner.query(
          `INSERT INTO network_configs (
            network,
            rpc_url,
            chain_id,
            is_active,
            required_confirmations,
            fallback_rpc_urls,
            network_settings,
            supports_eip1559,
            supports_flashbots,
            supports_erc20
          ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
          [
            network.network,
            network.rpc_url,
            network.chain_id,
            network.is_active,
            network.required_confirmations,
            network.fallback_rpc_urls ?? null,
            network.network_settings ?? JSON.stringify({}),
            network.supports_eip1559 ?? false,
            network.supports_flashbots ?? false,
            network.supports_erc20 ?? true,
          ],
        );
        console.log(`✓ Created network config: ${network.network}`);
      } else {
        console.log(`- Network config already exists: ${network.network}`);
      }
    }
  }
}
