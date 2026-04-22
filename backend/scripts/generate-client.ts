/**
 * Generates TypeScript types and a typed fetch client from docs/openapi.json.
 * Outputs to ../frontend/src/lib/api/ (skipped if the directory does not exist).
 *
 * Usage: ts-node scripts/generate-client.ts
 * Requires: openapi-typescript, openapi-fetch (install as devDependencies)
 */
import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const specPath = join(__dirname, '..', 'docs', 'openapi.json');
const frontendLib = join(__dirname, '..', '..', 'frontend', 'src', 'lib', 'api');

if (!existsSync(specPath)) {
  console.error('❌  docs/openapi.json not found. Run generate:openapi first.');
  process.exit(1);
}

if (!existsSync(join(__dirname, '..', '..', 'frontend'))) {
  console.warn('⚠️  frontend/ directory not found — skipping client generation.');
  process.exit(0);
}

mkdirSync(frontendLib, { recursive: true });

const typesOut = join(frontendLib, 'schema.d.ts');
execSync(
  `npx openapi-typescript ${specPath} --output ${typesOut}`,
  { stdio: 'inherit' },
);

console.log('✅  frontend/src/lib/api/schema.d.ts written');
console.log('ℹ️   Import createClient from openapi-fetch and pass the generated schema type.');
