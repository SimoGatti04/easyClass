/**
 * Master Test Runner for Teacher Service MVP
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const testFiles = [
  'tests/unit/materials.test.js',
  'tests/unit/permanent-delete.test.js',
  'tests/unit/generation.test.js',
  'tests/unit/omniroute-client.test.js',
  'tests/unit/web-research-client.test.js',
  'tests/unit/rules.test.js',
  'tests/unit/sources.test.js',
  'tests/unit/file-import-export.test.js',
  'tests/unit/attachment-transport.test.js',
  'tests/unit/attachment-parsers.test.js',
  'tests/unit/assessment-grading.test.js',
  'tests/unit/teacher-authorization.test.js',
  'tests/mcp/mcp-server.test.js',
  'tests/mcp/attachment-mcp.test.js',
  'tests/mcp/context-aware-generation.test.js',
  'tests/mcp/http-loopback-integration.test.js',
  'tests/mcp/http-transport.test.js',
  'tests/server/api-t1.test.js',
  'tests/server/pre-release-corrections.test.js',
  'tests/unit/migration-additive.test.js',
  'tests/integration/e2e.test.js',
  'tests/integration/t1-workflow.test.js'
];

console.log('====================================================');
console.log('      TEACHER SERVICE — PRODUCT MVP TEST SUITE      ');
console.log('====================================================\n');

let totalPassed = 0;
let totalFailed = 0;

for (const file of testFiles) {
  const fullPath = path.resolve(process.cwd(), file);
  console.log(`Running: ${file}...`);
  const res = spawnSync('node', ['--test', fullPath], {
    stdio: 'inherit',
    env: process.env
  });

  if (res.status === 0) {
    totalPassed++;
  } else {
    totalFailed++;
    console.error(`FAILED: ${file}`);
  }
}

console.log('\n====================================================');
console.log(`SUMMARY: ${totalPassed} suites passed, ${totalFailed} suites failed`);
console.log('====================================================');

if (totalFailed > 0) {
  process.exit(1);
}
