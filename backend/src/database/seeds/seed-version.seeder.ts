import { DataSource } from 'typeorm';

export interface SeedVersion {
  version: string;
  description: string;
  executedAt: Date;
}

export class SeedVersionSeeder {
  static async createVersionTable(dataSource: DataSource): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS seed_versions (
        id SERIAL PRIMARY KEY,
        version VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✓ Seed versions table ready');
  }

  static async recordVersion(
    dataSource: DataSource,
    version: string,
    description: string,
  ): Promise<void> {
    const queryRunner = dataSource.createQueryRunner();

    const exists = await queryRunner.query(
      `SELECT id FROM seed_versions WHERE version = $1`,
      [version],
    );

    if (exists.length === 0) {
      await queryRunner.query(
        `INSERT INTO seed_versions (version, description) VALUES ($1, $2)`,
        [version, description],
      );
      console.log(`✓ Recorded seed version: ${version}`);
    }
  }

  static async getLastVersion(
    dataSource: DataSource,
  ): Promise<SeedVersion | null> {
    const queryRunner = dataSource.createQueryRunner();

    const result = await queryRunner.query(
      `SELECT version, description, executed_at 
       FROM seed_versions 
       ORDER BY executed_at DESC 
       LIMIT 1`,
    );

    return result.length > 0 ? result[0] : null;
  }

  static async getAllVersions(dataSource: DataSource): Promise<SeedVersion[]> {
    const queryRunner = dataSource.createQueryRunner();

    return await queryRunner.query(
      `SELECT version, description, executed_at 
       FROM seed_versions 
       ORDER BY executed_at DESC`,
    );
  }
}
