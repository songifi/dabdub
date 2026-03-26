/**
 * Database integration test.
 *
 * Requires a live PostgreSQL instance pointed to by the DB_* env vars.
 * Recommended: use a dedicated test database (DB_NAME=dabdub_test).
 *
 * Run with:
 *   DB_NAME=dabdub_test pnpm test --testPathPattern=database.integration
 *
 * The test:
 *   1. Connects via AppDataSource (same config used by CLI / seed).
 *   2. Drops and re-creates the schema so each run starts clean.
 *   3. Runs all pending migrations.
 *   4. Seeds via the exported runSeed() function.
 *   5. Asserts that the expected tables and rows exist.
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

// Import after dotenv so AppDataSource reads the populated env.
import { AppDataSource } from './data-source';
import { runSeed } from './seed';
import { User } from '../users/entities/user.entity';
import {
  TierConfig,
  TierName,
} from '../tier-config/entities/tier-config.entity';
import { FeeConfig, FeeType } from '../fee-config/entities/fee-config.entity';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function tableExists(
  ds: DataSource,
  tableName: string,
): Promise<boolean> {
  const result = await ds.query<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name   = $1
     ) AS "exists"`,
    [tableName],
  );
  return result[0]?.exists ?? false;
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('Database — migrations + seed (integration)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = AppDataSource;
    await ds.initialize();

    // Wipe and rebuild so each CI run is hermetic.
    await ds.dropDatabase();
    await ds.synchronize(); // creates schema; we then run migrations on top
    await ds.runMigrations({ transaction: 'each' });
  }, 60_000 /* allow time for PG to respond */);

  afterAll(async () => {
    if (ds.isInitialized) {
      await ds.destroy();
    }
  });

  // ── Migration assertions ─────────────────────────────────────────────────────

  describe('after migrations', () => {
    it('creates the users table', async () => {
      expect(await tableExists(ds, 'users')).toBe(true);
    });

    it('creates the tier_configs table', async () => {
      expect(await tableExists(ds, 'tier_configs')).toBe(true);
    });

    it('creates the fee_configs table', async () => {
      expect(await tableExists(ds, 'fee_configs')).toBe(true);
    });
  });

  // ── Seed assertions ──────────────────────────────────────────────────────────

  describe('after seed', () => {
    beforeAll(async () => {
      await runSeed(ds);
    });

    it('creates the admin user', async () => {
      const user = await ds.getRepository(User).findOne({
        where: { isAdmin: true },
      });
      expect(user).toBeDefined();
      expect(user!.email).toBe(
        process.env['SEED_ADMIN_EMAIL'] ?? 'admin@system.local',
      );
      expect(user!.isActive).toBe(true);
    });

    it('creates the treasury user', async () => {
      const user = await ds.getRepository(User).findOne({
        where: { isTreasury: true },
      });
      expect(user).toBeDefined();
      expect(user!.email).toBe(
        process.env['SEED_TREASURY_EMAIL'] ?? 'treasury@system.local',
      );
    });

    it('creates exactly 3 tier configs (Silver, Gold, Black)', async () => {
      const tiers = await ds.getRepository(TierConfig).find({
        order: { name: 'ASC' },
      });
      expect(tiers).toHaveLength(3);
      expect(tiers.map((t) => t.name)).toEqual(
        expect.arrayContaining([
          TierName.SILVER,
          TierName.GOLD,
          TierName.BLACK,
        ]),
      );
    });

    it('Silver tier has feeMultiplier 1.0000 and minBalance 0', async () => {
      const silver = await ds.getRepository(TierConfig).findOneByOrFail({
        name: TierName.SILVER,
      });
      expect(parseFloat(silver.feeMultiplier)).toBe(1.0);
      expect(parseFloat(silver.minBalance)).toBe(0);
    });

    it('Gold tier has feeMultiplier 0.8000', async () => {
      const gold = await ds.getRepository(TierConfig).findOneByOrFail({
        name: TierName.GOLD,
      });
      expect(parseFloat(gold.feeMultiplier)).toBe(0.8);
    });

    it('Black tier has feeMultiplier 0.5000', async () => {
      const black = await ds.getRepository(TierConfig).findOneByOrFail({
        name: TierName.BLACK,
      });
      expect(parseFloat(black.feeMultiplier)).toBe(0.5);
    });

    it('creates exactly 3 fee configs (transfer, withdrawal, deposit)', async () => {
      const fees = await ds.getRepository(FeeConfig).find();
      expect(fees).toHaveLength(3);
      expect(fees.map((f) => f.feeType)).toEqual(
        expect.arrayContaining([
          FeeType.TRANSFER,
          FeeType.WITHDRAWAL,
          FeeType.DEPOSIT,
        ]),
      );
    });

    it('deposit fee has a 0 % rate', async () => {
      const deposit = await ds.getRepository(FeeConfig).findOneByOrFail({
        feeType: FeeType.DEPOSIT,
      });
      expect(parseFloat(deposit.baseFeeRate)).toBe(0);
    });

    it('seed is idempotent — running twice does not duplicate rows', async () => {
      await runSeed(ds); // second run

      const userCount = await ds.getRepository(User).count();
      const tierCount = await ds.getRepository(TierConfig).count();
      const feeCount = await ds.getRepository(FeeConfig).count();

      expect(userCount).toBe(2);
      expect(tierCount).toBe(3);
      expect(feeCount).toBe(3);
    });
  });
});
