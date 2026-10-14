import { spawnSync } from 'node:child_process';
import path from 'node:path';

const files = [
  'tests/mcp/mcp-server.test.js',
  'tests/mcp/attachment-mcp.test.js',
  'tests/mcp/context-aware-generation.test.js',
  'tests/mcp/http-loopback-integration.test.js',
  'tests/mcp/http-transport.test.js'
];
for (const file of files) {
  const res = spawnSync('node', ['--test', path.resolve(process.cwd(), file)], { stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status);
}
