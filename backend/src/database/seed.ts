/**
 * Standalone seed script.
 *
 * Run with:
 *   pnpm seed:run
 *   (maps to: ts-node src/database/seed.ts)
 *
 * The script is fully idempotent — safe to run multiple times.
 * Existing rows are matched by their unique business key (email / tier name / fee type)
 * and updated if they differ; nothing is deleted.
 */
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { DataSource, Repository } from 'typeorm';
import { AppDataSource } from './data-source';
import { User, UserRole } from '../users/entities/user.entity';
import {
  TierConfig,
  TierName,
} from '../tier-config/entities/tier-config.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../rbac/rbac.types';
import { TierConfig, TierName } from '../tier-config/entities/tier-config.entity';
import { FeeConfig, FeeType } from '../fee-config/entities/fee-config.entity';

// ── Constants ──────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

// Default passwords — override via env vars in your deployment pipeline.
const ADMIN_EMAIL = process.env['SEED_ADMIN_EMAIL'] ?? 'admin@system.local';
const ADMIN_PASSWORD =
  process.env['SEED_ADMIN_PASSWORD'] ?? 'Admin@System!SecureChangeMe';
const TREASURY_EMAIL =
  process.env['SEED_TREASURY_EMAIL'] ?? 'treasury@system.local';
const TREASURY_PASSWORD =
  process.env['SEED_TREASURY_PASSWORD'] ?? 'Treasury@System!SecureChangeMe';

// ── Seed definitions ───────────────────────────────────────────────────────────

interface UserSeed {
  email: string;
  password: string;
  displayName: string;
  isAdmin: boolean;
  isTreasury: boolean;
}

const USER_SEEDS: UserSeed[] = [
  {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    displayName: 'System Administrator',
    isAdmin: true,
    isTreasury: false,
  },
  {
    email: TREASURY_EMAIL,
    password: TREASURY_PASSWORD,
    displayName: 'Fee Treasury',
    isAdmin: false,
    isTreasury: true,
  },
];

interface TierSeed {
  name: TierName;
  minBalance: string;
  feeMultiplier: string;
  dailyLimit: string;
  monthlyLimit: string;
}

const TIER_SEEDS: TierSeed[] = [
  {
    name: TierName.SILVER,
    minBalance: '0', // default tier — everyone starts here
    feeMultiplier: '1.0000', // no discount
    dailyLimit: '1000.00000000',
    monthlyLimit: '10000.00000000',
  },
  {
    name: TierName.GOLD,
    minBalance: '10000.00000000',
    feeMultiplier: '0.8000', // 20 % fee discount
    dailyLimit: '5000.00000000',
    monthlyLimit: '50000.00000000',
  },
  {
    name: TierName.BLACK,
    minBalance: '100000.00000000',
    feeMultiplier: '0.5000', // 50 % fee discount
    dailyLimit: '50000.00000000',
    monthlyLimit: '500000.00000000',
  },
];

interface FeeSeed {
  feeType: FeeType;
  baseFeeRate: string;
  minFee: string;
  maxFee: string | null;
}

const FEE_SEEDS: FeeSeed[] = [
  {
    feeType: FeeType.TRANSFER,
    baseFeeRate: '0.010000', // 1 %
    minFee: '0.00100000',
    maxFee: null,
  },
  {
    feeType: FeeType.WITHDRAWAL,
    baseFeeRate: '0.020000', // 2 %
    minFee: '0.00200000',
    maxFee: null,
  },
  {
    feeType: FeeType.DEPOSIT,
    baseFeeRate: '0.000000', // free
    minFee: '0',
    maxFee: null,
  },
];

// ── Seeders ────────────────────────────────────────────────────────────────────

async function seedUsers(repo: Repository<User>): Promise<void> {
  console.log('  Seeding users...');

  for (const seed of USER_SEEDS) {
    const existing = await repo.findOne({ where: { email: seed.email } });

    if (existing) {
      console.log(`    [skip] user already exists: ${seed.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(seed.password, BCRYPT_ROUNDS);

    await repo.save(
      repo.create({
        email: seed.email,
        passwordHash,
        displayName: seed.displayName,
        isAdmin: seed.isAdmin,
        role: seed.isAdmin ? Role.Admin : Role.User,
        isMerchant: false,
        isTreasury: seed.isTreasury,
        isActive: true,
      }),
    );

    console.log(`    [created] user: ${seed.email}`);
  }
}

async function seedTiers(repo: Repository<TierConfig>): Promise<void> {
  console.log('  Seeding tier configs...');

  for (const seed of TIER_SEEDS) {
    await repo.upsert(
      {
        name: seed.name,
        minBalance: seed.minBalance,
        feeMultiplier: seed.feeMultiplier,
        dailyLimit: seed.dailyLimit,
        monthlyLimit: seed.monthlyLimit,
        isActive: true,
      },
      { conflictPaths: ['name'], skipUpdateIfNoValuesChanged: true },
    );

    console.log(`    [upserted] tier: ${seed.name}`);
  }
}

async function seedFeeConfigs(repo: Repository<FeeConfig>): Promise<void> {
  console.log('  Seeding fee configs...');

  for (const seed of FEE_SEEDS) {
    await repo.upsert(
      {
        feeType: seed.feeType,
        baseFeeRate: seed.baseFeeRate,
        minFee: seed.minFee,
        maxFee: seed.maxFee,
        isActive: true,
      },
      { conflictPaths: ['feeType'], skipUpdateIfNoValuesChanged: true },
    );

    console.log(`    [upserted] fee: ${seed.feeType}`);
  }
}

// ── Entry point ────────────────────────────────────────────────────────────────

async function runSeed(dataSource: DataSource): Promise<void> {
  await seedUsers(dataSource.getRepository(User));
  await seedTiers(dataSource.getRepository(TierConfig));
  await seedFeeConfigs(dataSource.getRepository(FeeConfig));
}

async function main(): Promise<void> {
  console.log('[seed] Connecting to database...');
  await AppDataSource.initialize();
  console.log('[seed] Connected.');

  try {
    await runSeed(AppDataSource);
    console.log('[seed] Done.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});

// Re-export for integration tests that want to call runSeed directly.
export { runSeed };
