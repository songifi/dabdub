import * as fs from 'fs/promises';
import * as path from 'path';

export type MigrationSafetyIssue = {
  file: string;
  line: number;
  rule: string;
  snippet: string;
};

const RULES: Array<{ rule: string; regex: RegExp }> = [
  { rule: 'DROP COLUMN detected', regex: /\bDROP\s+COLUMN\b/i },
  {
    rule: 'CREATE INDEX without CONCURRENTLY',
    regex: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b(?!\s+CONCURRENTLY)/i,
  },
  { rule: 'ALTER COLUMN TYPE detected', regex: /\bALTER\s+COLUMN\b[\s\S]*?\bTYPE\b/i },
  { rule: 'RENAME COLUMN detected', regex: /\bRENAME\s+COLUMN\b/i },
];

export async function findMigrationSafetyIssues(
  migrationsDir: string,
): Promise<MigrationSafetyIssue[]> {
  const entries = await fs.readdir(migrationsDir);
  const tsFiles = entries
    .filter((f: string) => f.endsWith('.ts'))
    .sort((a: string, b: string) => a.localeCompare(b));

  const issues: MigrationSafetyIssue[] = [];

  for (const file of tsFiles) {
    const fullPath = path.join(migrationsDir, file);
    const raw = await fs.readFile(fullPath, 'utf8');
    const lines = raw.split(/\r?\n/);

    let inUpMethod = false;

    lines.forEach((line: string, idx: number) => {
      if (/public\s+async\s+up\s*\(/.test(line)) {
        inUpMethod = true;
      }
      if (/public\s+async\s+down\s*\(/.test(line)) {
        inUpMethod = false;
      }
      if (!inUpMethod) {
        return;
      }

      for (const { rule, regex } of RULES) {
        if (regex.test(line)) {
          issues.push({
            file,
            line: idx + 1,
            rule,
            snippet: line.trim(),
          });
        }
      }
    });
  }

  return issues;
}
