import { DataSource } from 'typeorm';

export interface NetworkConfig {
  id: string;
  name: string;
  network: string;
  rpcUrl: string;
  chainId: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer: string;
  isActive: boolean;
}

export class NetworkConfigSeeder {
  static async seed(dataSource: DataSource): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();

    // Create network_configs table if it doesn't exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS network_configs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        network VARCHAR(50) NOT NULL UNIQUE,
        rpc_url TEXT NOT NULL,
        chain_id INTEGER NOT NULL,
        native_currency JSONB NOT NULL,
        block_explorer TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const networks = [
      {
        name: 'Ethereum Mainnet',
        network: 'ethereum',
        rpc_url: 'https://eth.llamarpc.com',
        chain_id: 1,
        native_currency: JSON.stringify({
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        }),
        block_explorer: 'https://etherscan.io',
        is_active: true,
      },
      {
        name: 'Polygon Mainnet',
        network: 'polygon',
        rpc_url: 'https://polygon-rpc.com',
        chain_id: 137,
        native_currency: JSON.stringify({
          name: 'MATIC',
          symbol: 'MATIC',
          decimals: 18,
        }),
        block_explorer: 'https://polygonscan.com',
        is_active: true,
      },
      {
        name: 'Stellar Testnet',
        network: 'stellar-testnet',
        rpc_url: 'https://horizon-testnet.stellar.org',
        chain_id: 0,
        native_currency: JSON.stringify({
          name: 'Stellar Lumens',
          symbol: 'XLM',
          decimals: 7,
        }),
        block_explorer: 'https://stellar.expert/explorer/testnet',
        is_active: true,
      },
      {
        name: 'Stellar Mainnet',
        network: 'stellar-mainnet',
        rpc_url: 'https://horizon.stellar.org',
        chain_id: 0,
        native_currency: JSON.stringify({
          name: 'Stellar Lumens',
          symbol: 'XLM',
          decimals: 7,
        }),
        block_explorer: 'https://stellar.expert/explorer/public',
        is_active: true,
      },
      {
        name: 'Base Mainnet',
        network: 'base',
        rpc_url: 'https://mainnet.base.org',
        chain_id: 8453,
        native_currency: JSON.stringify({
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        }),
        block_explorer: 'https://basescan.org',
        is_active: true,
      },
      {
        name: 'Arbitrum One',
        network: 'arbitrum',
        rpc_url: 'https://arb1.arbitrum.io/rpc',
        chain_id: 42161,
        native_currency: JSON.stringify({
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
        }),
        block_explorer: 'https://arbiscan.io',
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
          `INSERT INTO network_configs (name, network, rpc_url, chain_id, native_currency, block_explorer, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            network.name,
            network.network,
            network.rpc_url,
            network.chain_id,
            network.native_currency,
            network.block_explorer,
            network.is_active,
          ],
        );
        console.log(`✓ Created network config: ${network.name}`);
      } else {
        console.log(`- Network config already exists: ${network.name}`);
      }
    }
  }
}
