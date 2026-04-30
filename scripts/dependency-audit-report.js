#!/usr/bin/env node
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function usage() {
  console.error('Usage: node scripts/dependency-audit-report.js <directory> --output <file>');
  process.exit(1);
}

const args = process.argv.slice(2);
const directory = args[0];
const outputFlagIndex = args.indexOf('--output');
const outputPath = outputFlagIndex !== -1 ? args[outputFlagIndex + 1] : null;

if (!directory || !outputPath) {
  usage();
}

const cwd = path.resolve(process.cwd(), directory);

function formatReport(result) {
  const lines = [];
  lines.push(`Audit report for ${directory}`);
  lines.push('='.repeat(lines[0].length));
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  if (!result.metadata) {
    lines.push('No audit metadata available.');
    return lines.join('\n');
  }

  const { vulnerabilities = {}, dependencies = 0, devDependencies = 0, optionalDependencies = 0, totalDependencies = 0 } = result.metadata;
  lines.push(`Dependencies: ${totalDependencies}`);
  lines.push(`Vulnerabilities: ${Object.values(vulnerabilities).reduce((sum, v) => sum + v, 0)}`);
  lines.push(`  low: ${vulnerabilities.low || 0}`);
  lines.push(`  moderate: ${vulnerabilities.moderate || 0}`);
  lines.push(`  high: ${vulnerabilities.high || 0}`);
  lines.push(`  critical: ${vulnerabilities.critical || 0}`);
  lines.push('');

  if (result.advisories && Object.keys(result.advisories).length > 0) {
    lines.push('Advisories:');
    for (const advisory of Object.values(result.advisories)) {
      lines.push(`- [${advisory.severity}] ${advisory.module_name}`);
      lines.push(`  Title: ${advisory.title}`);
      lines.push(`  Recommendation: ${advisory.recommendation || 'Update dependency to patched version.'}`);
      lines.push(`  URL: ${advisory.url}`);
      if (advisory.findings && advisory.findings.length > 0) {
        const paths = Array.from(new Set(advisory.findings.flatMap((f) => f.paths || []))).slice(0, 5);
        if (paths.length) {
          lines.push(`  Paths: ${paths.join(', ')}`);
        }
      }
      lines.push('');
    }
  } else {
    lines.push('No vulnerabilities found.');
  }

  return lines.join('\n');
}

execFile('npm', ['audit', '--json'], { cwd }, (error, stdout, stderr) => {
  let result;

  try {
    result = JSON.parse(stdout || stderr);
  } catch (parseError) {
    console.error('Failed to parse npm audit output:', parseError.message);
    console.error(stdout || stderr);
    process.exit(2);
  }

  const report = formatReport(result);
  fs.writeFileSync(path.resolve(process.cwd(), outputPath), report, 'utf8');
  console.log(report);
  process.exit(0);
});
