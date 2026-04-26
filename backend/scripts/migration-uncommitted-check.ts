#!/usr/bin/env ts-node
/**
 * CI check: fails if there are uncommitted migration files.
 * Ensures generated migrations are always committed before merging.
 */
import { execSync } from 'child_process';

const output = execSync('git status --porcelain src/database/migrations/', { encoding: 'utf8' });

if (output.trim().length > 0) {
  console.error('ERROR: Uncommitted migration files detected:');
  console.error(output);
  console.error('Run `git add src/database/migrations/` and commit before pushing.');
  process.exit(1);
}

console.log('Migration check passed: no uncommitted migration files.');
