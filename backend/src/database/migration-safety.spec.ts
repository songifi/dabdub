import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { findMigrationSafetyIssues } from './migration-safety';

describe('migration safety checker', () => {
  it('detects DROP COLUMN usage', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'migration-safety-'));
    const migrationPath = path.join(tmpDir, '1700000000000-Test.ts');

    await fs.writeFile(
      migrationPath,
      'await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "old_col"`);\n',
      'utf8',
    );

    const issues = await findMigrationSafetyIssues(tmpDir);
    expect(issues.some((i) => i.rule.includes('DROP COLUMN'))).toBe(true);
  });
});
