import * as path from 'path';
import { findMigrationSafetyIssues } from '../src/database/migration-safety';

async function main(): Promise<void> {
  const migrationsDir = path.resolve(process.cwd(), 'src/database/migrations');
  const issues = await findMigrationSafetyIssues(migrationsDir);

  if (issues.length === 0) {
    console.log('Migration safety check passed: no unsafe patterns found.');
    return;
  }

  console.error('Migration safety check failed. Unsafe patterns found:');
  for (const issue of issues) {
    console.error(
      `- ${issue.file}:${issue.line} [${issue.rule}] ${issue.snippet}`,
    );
  }

  process.exitCode = 1;
}

void main();
