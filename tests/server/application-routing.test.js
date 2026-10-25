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

  let started;
  try {
    started = await app.start(0, '127.0.0.1');
  } catch (error) {
    if (error?.code === 'EPERM') {
      t.skip('Sandbox policy denied loopback bind; run on host with network permission');
      return;
    }
    throw error;
  }
  const { url } = started;
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

  // Unrecognized API path returns 404 JSON, never SPA HTML
  const unknownStudentApi = await fetch(`${url}/api/student/unknown-endpoint`);
  assert.equal(unknownStudentApi.status, 404, "unrecognized student API path must return 404 JSON");
  assert.match(unknownStudentApi.headers.get("content-type") || "", /application\/json/);
  const unknownStudentJson = await unknownStudentApi.json();
  assert.match(unknownStudentJson.message || "", /Route studente non trovata/);

  // Missing static asset with extension returns 404 JSON, never SPA fallback
  const missingAsset = await fetch(`${url}/assets/nonexistent-file.css`);
  assert.equal(missingAsset.status, 404, "missing asset with extension must return 404");
  assert.match(missingAsset.headers.get("content-type") || "", /application\/json/);

  // Deep client-side SPA route without extension returns 200 HTML
  const deepSpaRoute = await fetch(`${url}/studente/qualche/percorso`);
  assert.equal(deepSpaRoute.status, 200, "deep client SPA route must return 200 HTML");
  assert.match(deepSpaRoute.headers.get("content-type") || "", /text\/html/);

  // Legacy teacher hashes must make a new HTTP request to /docente; they may
  // never render the teacher route while remaining on the public root path.
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`${url}/#/docente`);
  await page.waitForURL((current) => new URL(current).pathname === '/docente');
  assert.equal(new URL(page.url()).pathname, '/docente');
});
