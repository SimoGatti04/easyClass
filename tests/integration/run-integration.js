import { spawnSync } from 'node:child_process';
import path from 'node:path';

const files = ['tests/integration/e2e.test.js'];
for (const file of files) {
  const res = spawnSync('node', ['--test', path.resolve(process.cwd(), file)], { stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status);
}
