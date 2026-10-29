import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE_DIRS = ['src', 'bin', 'client/src'];
const IMPORT_PATTERN = /(?:from|import|import\()\s*['"](\.[^'"]+)['"]/g;

function listJavaScriptFiles(relativeDir) {
  const absoluteDir = path.join(repoRoot, relativeDir);
  if (!fs.existsSync(absoluteDir)) return [];
  const found = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) found.push(path.relative(repoRoot, full));
    }
  };
  walk(absoluteDir);
  return found.sort();
}

function resolveSpecifier(fromFile, specifier) {
  const target = path.resolve(repoRoot, path.dirname(fromFile), specifier.split('?')[0]);
  const candidates = target.endsWith('.js') ? [target] : [target, `${target}.js`, path.join(target, 'index.js')];
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

test('source closure: every application module is present and version-controlled', async (t) => {
  const files = SOURCE_DIRS.flatMap(listJavaScriptFiles);
  assert.ok(files.length > 0, 'expected to find application sources');

  await t.test('every relative import resolves to a file in the repository', () => {
    const unresolved = [];
    for (const file of files) {
      const source = fs.readFileSync(path.join(repoRoot, file), 'utf8');
      for (const match of source.matchAll(IMPORT_PATTERN)) {
        if (!resolveSpecifier(file, match[1])) unresolved.push(`${file} -> ${match[1]}`);
      }
    }
    assert.deepEqual(unresolved, [], `unresolved relative imports:\n${unresolved.join('\n')}`);
  });

  await t.test('storage modules required at runtime are present', () => {
    for (const required of ['src/storage/filestore.js', 'src/storage/store-snapshot.js']) {
      assert.ok(fs.existsSync(path.join(repoRoot, required)), `${required} must exist`);
    }
  });

  await t.test('no source file is excluded from Git by an ignore pattern', (ctx) => {
    const listed = spawnSync('git', ['ls-files', '-z', ...SOURCE_DIRS], { cwd: repoRoot, encoding: 'utf8' });
    if (listed.status !== 0) {
      ctx.skip('git metadata unavailable in this environment');
      return;
    }
    const tracked = new Set(listed.stdout.split('\0').filter(Boolean));
    if (tracked.size === 0) {
      ctx.skip('no tracked sources visible from this checkout');
      return;
    }
    const untracked = files.filter(file => !tracked.has(file));
    assert.deepEqual(untracked, [],
      `source files present on disk but excluded from version control:\n${untracked.join('\n')}`);
  });
});
