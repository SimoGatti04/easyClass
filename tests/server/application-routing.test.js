import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createHttpApp } from '../../src/server/http.js';
import { setTestAuthKeys, clearJwksCache } from '../../src/server/auth.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';

test('real path routing serves public/student/teacher deep links and keeps APIs outside SPA fallback', async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-routing-'));
  const service = new TeacherService({ dbManager: new DatabaseManager(':memory:').init(), fileStore: new FileStore(path.join(temp, 'files')), mockAi: true });
  const app = await createHttpApp({
    service,
    authConfig: { webAud: 'teacher-service-routing-test', expectedIss: 'https://routing-test.example.test' }
  });
  let browser;
  t.after(async () => {
    try { await browser?.close(); } catch {}
    await app.close();
    service.close();
    clearJwksCache();
    setTestAuthKeys(null);
    fs.rmSync(temp, { recursive: true, force: true });
  });

  const { url } = await app.start(0, '127.0.0.1');
  const pages = ['/', '/studente', '/studente/attivita/demo', '/docente', '/docente/attivita/demo'];
  let canonicalIndex;
  for (const route of pages) {
    const response = await fetch(`${url}${route}`);
    assert.equal(response.status, 200, `${route} must receive the SPA shell`);
    assert.match(response.headers.get('content-type') || '', /text\/html/);
    const html = await response.text();
    assert.match(html, /id="app"/);
    canonicalIndex ??= html;
    assert.equal(html, canonicalIndex, `${route} must return the same client entry point`);
  }
  const teacherApi = await fetch(`${url}/api/classes`);
  assert.equal(teacherApi.status, 401, 'management API is not an SPA route and still requires teacher authentication');
  const studentApi = await fetch(`${url}/api/student/activities/not-a-session/submission`);
  assert.equal(studentApi.status, 401, 'student API is routed to session checks rather than the SPA fallback');

  // Legacy teacher hashes must make a new HTTP request to /docente; they may
  // never render the teacher route while remaining on the public root path.
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${url}/#/docente`);
  await page.waitForURL((current) => new URL(current).pathname === '/docente');
  assert.equal(new URL(page.url()).pathname, '/docente');
});
