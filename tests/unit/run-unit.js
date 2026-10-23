import { spawnSync } from 'node:child_process';
import path from 'node:path';

const files = [
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
  'tests/unit/integrity-analysis.test.js',
  'tests/unit/teacher-authorization.test.js'
];
for (const file of files) {
  const res = spawnSync('node', ['--test', path.resolve(process.cwd(), file)], { stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status);
}
