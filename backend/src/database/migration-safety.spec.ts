import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { findMigrationSafetyIssues } from './migration-safety';

async function writeMigration(dir: string, name: string, content: string): Promise<void> {
  await fs.writeFile(path.join(dir, name), content, 'utf8');
}

describe('migration safety checker', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'migration-safety-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('detects DROP COLUMN in up() method', async () => {
    await writeMigration(
      tmpDir,
      '1700000000000-Test.ts',
      `public async up(queryRunner) {\n  await queryRunner.query(\`ALTER TABLE "users" DROP COLUMN "old_col"\`);\n}\npublic async down(queryRunner) {}`,
    );

    const issues = await findMigrationSafetyIssues(tmpDir);
    expect(issues.some((i) => i.rule.includes('DROP COLUMN'))).toBe(true);
  });

  it('detects CREATE INDEX without CONCURRENTLY', async () => {
    await writeMigration(
      tmpDir,
      '1700000000001-Test.ts',
      `public async up(queryRunner) {\n  await queryRunner.query(\`CREATE INDEX "IDX_foo" ON "users" ("email")\`);\n}\npublic async down(queryRunner) {}`,
    );

    const issues = await findMigrationSafetyIssues(tmpDir);
    expect(issues.some((i) => i.rule.includes('CREATE INDEX without CONCURRENTLY'))).toBe(true);
  });

  it('does NOT flag CREATE INDEX CONCURRENTLY', async () => {
    await writeMigration(
      tmpDir,
      '1700000000002-Test.ts',
      `public async up(queryRunner) {\n  await queryRunner.query(\`CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_foo" ON "users" ("email")\`);\n}\npublic async down(queryRunner) {}`,
    );

    const issues = await findMigrationSafetyIssues(tmpDir);
    expect(issues.some((i) => i.rule.includes('CREATE INDEX without CONCURRENTLY'))).toBe(false);
  });

  it('detects RENAME COLUMN in up() method', async () => {
    await writeMigration(
      tmpDir,
      '1700000000003-Test.ts',
      `public async up(queryRunner) {\n  await queryRunner.query(\`ALTER TABLE "users" RENAME COLUMN "old" TO "new"\`);\n}\npublic async down(queryRunner) {}`,
    );

    const issues = await findMigrationSafetyIssues(tmpDir);
    expect(issues.some((i) => i.rule.includes('RENAME COLUMN'))).toBe(true);
  });

  it('does NOT flag DROP COLUMN in down() method', async () => {
    await writeMigration(
      tmpDir,
      '1700000000004-Test.ts',
      `public async up(queryRunner) {\n  await queryRunner.query(\`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "new_col" text\`);\n}\npublic async down(queryRunner) {\n  await queryRunner.query(\`ALTER TABLE "users" DROP COLUMN "new_col"\`);\n}`,
    );

    const issues = await findMigrationSafetyIssues(tmpDir);
    expect(issues.some((i) => i.rule.includes('DROP COLUMN'))).toBe(false);
  });

  it('returns no issues for a safe migration', async () => {
    await writeMigration(
      tmpDir,
      '1700000000005-Test.ts',
      `public async up(queryRunner) {\n  await queryRunner.query("SET lock_timeout = '5s'");\n  await queryRunner.query(\`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "new_col" text NULL\`);\n}\npublic async down(queryRunner) {}`,
    );

    const issues = await findMigrationSafetyIssues(tmpDir);
    expect(issues).toHaveLength(0);
  });
});
