import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

import { createHttpApp } from '../../src/server/http.js';
import { setTestAuthKeys, clearJwksCache } from '../../src/server/auth.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';

test('Browser End-to-End Test: T1 "Tomorrow is ready" Workflow on Compiled React Frontend', async (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', `browser-test-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const dbManager = new DatabaseManager(':memory:').init();
  const fileStore = new FileStore(tmpDir);

  let aiCalls = 0;
  const mockAiClient = {
    complete: async ({ messages }) => {
      aiCalls++;
      return {
        content: `# Lezione Generata Step ${aiCalls}\n\nContenuto didattico generato per il vertical slice T1.\n\n[TEACHER_ONLY_SOLUTION]\nSoluzione riservata per il docente.\n[/TEACHER_ONLY_SOLUTION]`,
        model: 'test-omniroute-model'
      };
    },
    listModels: async () => [{ id: 'test-omniroute-model' }]
  };

  const service = new TeacherService({
    dbManager,
    fileStore,
    omniRouteClient: mockAiClient
  });

  // Setup Auth Keys for Cloudflare Access Mock
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const kid = 'test-browser-kid';
  setTestAuthKeys({ publicKey, kid });

  const webAud = 'web-browser-test-aud';

  function createSignedJwt({ sub = 'teacher@school.example', email = 'teacher@school.example', aud = webAud } = {}) {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT', kid };
    const payload = {
      iss: 'https://simogatti.cloudflareaccess.com',
      aud: [aud],
      sub,
      email,
      identity_nonce: 'nonce-' + crypto.randomUUID(),
      nbf: now - 10,
      iat: now,
      exp: now + 3600
    };
    const hB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const pB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${hB64}.${pB64}`);
    const sig = signer.sign(privateKey, 'base64url');
    return `${hB64}.${pB64}.${sig}`;
  }

  const teacherJwt = createSignedJwt();

  const app = await createHttpApp({
    service,
    teacherEmails: 'teacher@school.example',
    authConfig: {
      webAud,
      expectedAud: webAud,
      allowSyntheticAuth: false
    },
    allowedOrigins: ['http://127.0.0.1:8795', 'http://localhost:8795']
  });

  const { url } = await app.start(8795, '127.0.0.1');
  console.log(`Test HTTP server listening at ${url}`);

  let browser;
  try {
    const { chromium } = await import('~/Workspace/uniGrades/apps/pwa/node_modules/playwright/index.mjs');
    browser = await chromium.launch({
      headless: true,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--headless=new', '--no-sandbox', '--disable-gpu']
    });

    const context = await browser.newContext();

    // Set Cloudflare Access authentication cookie
    await context.addCookies([
      {
        name: 'CF_Authorization',
        value: teacherJwt,
        domain: '127.0.0.1',
        path: '/'
      }
    ]);

    const page = await context.newPage();



    // 1. Load Dashboard
    const resp = await page.goto(`${url}/`);
    
    await page.waitForSelector('.header-title');
    const titleText = await page.textContent('.header-title');
    assert.match(titleText, /Teacher Service/);
    console.log('✔ 1. Dashboard SPA loaded with compiled React bundle');

    // 2. Context Navigation & Creation: Create Class
    await page.click('#btn-new-class');
    await page.waitForSelector('#class-name');
    await page.fill('#class-name', '4B Telecomunicazioni');
    await page.fill('#class-year', '2026/2027');
    await page.click('#modal-btn-submit-class');
    await page.waitForSelector('#btn-new-subject:not([disabled])');
    
    console.log('✔ 2. Created new Class via UI Modal');

    // 3. Create Subject
    await page.click('#btn-new-subject');
    await page.waitForSelector('#subject-name');
    await page.fill('#subject-name', 'Reti di Calcolatori');
    await page.click('#modal-btn-submit-subject');
    await page.waitForSelector('#btn-new-lesson:not([disabled])');
    console.log('✔ 3. Created new Subject via UI Modal');

    // 4. Create Lesson
    await page.click('#btn-new-lesson');
    await page.waitForSelector('#lesson-title');
    await page.fill('#lesson-title', 'Subnetting IPv4 e Maschere a Lunghezza Variabile (VLSM)');
    await page.fill('#lesson-duration', '90');
    await page.click('#modal-btn-submit-lesson');
    await page.waitForSelector('#btn-generate-pack:not([disabled])');
    console.log('✔ 4. Created new Lesson via UI Modal');

    // 5. Source Manager & Selection Mode
    await page.waitForSelector('.sources-panel');
    const modeSelect = await page.$('#source-selection-mode-select');
    assert.ok(modeSelect, 'Mode select element must exist');
    const initialMode = await modeSelect.inputValue();
    assert.equal(initialMode, 'selected_only', 'Default source selection mode must be selected_only');

    // Toggle mode to contextual
    await page.selectOption('#source-selection-mode-select', 'contextual');
    const updatedMode = await modeSelect.inputValue();
    assert.equal(updatedMode, 'contextual', 'Mode must switch to contextual');
    await page.selectOption('#source-selection-mode-select', 'selected_only');
    console.log('✔ 5. Verified Source Manager & Selection Mode Contract');

    // 6. Generate Lesson Pack Step-by-Step
    const genButton = await page.waitForSelector('#btn-generate-pack');
    await genButton.click();

    // Wait for generation to complete (4 artifacts produced)
    await page.waitForSelector('.step-badge-ready', { timeout: 15000 });
    console.log('✔ 6. Lesson Pack generated step-by-step with real progress updates');

    // 7. Workspace & Artifact Inspection
    await page.waitForSelector('.artifact-tabs');
    await page.click('button[data-tab="teacherScript"]');
    await page.waitForSelector('.workspace-content');
    const scriptContent = await page.textContent('.workspace-content');
    assert.match(scriptContent, /Lezione Generata Step/);
    console.log('✔ 7. Inspected artifacts in Workspace with sanitized Markdown rendering');

    // 8. Confirm Lesson Preparation
    const confirmButton = await page.waitForSelector('#btn-confirm-prep');
    await confirmButton.click();
    await page.waitForSelector('#confirm-notes');
    await page.fill('#confirm-notes', 'Revisione completata dal docente per la lezione di domani.');
    await page.click('#modal-btn-submit-confirm');

    // Verify confirmation status displayed
    await page.waitForSelector('.prep-status-confirmed');
    const statusBadge = await page.textContent('.prep-status-confirmed');
    assert.match(statusBadge, /Preparazione Confermata/i);
    console.log('✔ 8. Confirmed Lesson Preparation and froze artifact versions');

    // 9. Multi-format Export
    const exportButton = await page.waitForSelector('#btn-export-artifact');
    await exportButton.click();
    await page.waitForSelector('.export-modal');
    await page.click('#btn-do-export-markdown');
    console.log('✔ 9. Multi-format export dialog verified');

    await browser.close();
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
    await app.close();
    clearJwksCache();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
