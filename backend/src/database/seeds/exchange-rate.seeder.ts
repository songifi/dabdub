import { DataSource } from 'typeorm';

export class ExchangeRateSeeder {
  static async seed(dataSource: DataSource): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();

    // Create exchange_rates table if it doesn't exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        from_currency VARCHAR(10) NOT NULL,
        to_currency VARCHAR(10) NOT NULL,
        rate DECIMAL(19, 7) NOT NULL,
        source VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_currency, to_currency)
      )
    `);

    // Create index for faster lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_exchange_rates_currencies 
      ON exchange_rates(from_currency, to_currency)
    `);

    const rates = [
      // USD to Crypto
      { from_currency: 'USD', to_currency: 'BTC', rate: 0.000023, source: 'seed' },
      { from_currency: 'USD', to_currency: 'ETH', rate: 0.00038, source: 'seed' },
      { from_currency: 'USD', to_currency: 'USDC', rate: 1.0, source: 'seed' },
      { from_currency: 'USD', to_currency: 'USDT', rate: 1.0, source: 'seed' },
      { from_currency: 'USD', to_currency: 'XLM', rate: 8.5, source: 'seed' },
      { from_currency: 'USD', to_currency: 'MATIC', rate: 1.2, source: 'seed' },
      
      // Crypto to USD
      { from_currency: 'BTC', to_currency: 'USD', rate: 43500.0, source: 'seed' },
      { from_currency: 'ETH', to_currency: 'USD', rate: 2650.0, source: 'seed' },
      { from_currency: 'USDC', to_currency: 'USD', rate: 1.0, source: 'seed' },
      { from_currency: 'USDT', to_currency: 'USD', rate: 1.0, source: 'seed' },
      { from_currency: 'XLM', to_currency: 'USD', rate: 0.118, source: 'seed' },
      { from_currency: 'MATIC', to_currency: 'USD', rate: 0.83, source: 'seed' },
      
      // Stablecoin pairs
      { from_currency: 'USDC', to_currency: 'USDT', rate: 1.0, source: 'seed' },
      { from_currency: 'USDT', to_currency: 'USDC', rate: 1.0, source: 'seed' },
      
      // Cross-crypto pairs
      { from_currency: 'ETH', to_currency: 'BTC', rate: 0.061, source: 'seed' },
      { from_currency: 'BTC', to_currency: 'ETH', rate: 16.4, source: 'seed' },
    ];

    for (const rate of rates) {
      const exists = await queryRunner.query(
        `SELECT id FROM exchange_rates WHERE from_currency = $1 AND to_currency = $2`,
        [rate.from_currency, rate.to_currency],
      );

      if (exists.length === 0) {
        await queryRunner.query(
          `INSERT INTO exchange_rates (from_currency, to_currency, rate, source, is_active)
           VALUES ($1, $2, $3, $4, $5)`,
          [rate.from_currency, rate.to_currency, rate.rate, rate.source, true],
        );
        console.log(
          `✓ Created exchange rate: ${rate.from_currency}/${rate.to_currency} = ${rate.rate}`,
        );
      } else {
        console.log(
          `- Exchange rate already exists: ${rate.from_currency}/${rate.to_currency}`,
        );
      }
    }
  }
}
