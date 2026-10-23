import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';

import { chromium } from 'playwright';
import { createHttpApp } from '../../src/server/http.js';
import { setTestAuthKeys, clearJwksCache } from '../../src/server/auth.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';

test('C4 real browser workflow: two students, responsive viewports, offline recovery, attachments, timer, final submission', async (t) => {
  const runRoot = path.resolve(process.cwd(), '.tmp', 'dev-preview', `c4-browser-${process.pid}-${Date.now()}`);
  const dbPath = path.join(runRoot, 'teacher-c4-e2e.sqlite');
  const filesPath = path.join(runRoot, 'filestore');
  fs.mkdirSync(runRoot, { recursive: true });

  const dbManager = new DatabaseManager(dbPath).init();
  const fileStore = new FileStore(filesPath);
  const service = new TeacherService({ dbManager, fileStore, mockAi: true });

  const classroom = service.createClass({ name: '4A Informatica — C4 E2E', academicYear: '2026/2027' });
  const subject = service.createSubject({ classId: classroom.id, name: 'Basi di Dati' });
  const student1 = service.addStudent({ classId: classroom.id, firstName: 'Ada', lastName: 'Lovelace' });
  const student2 = service.addStudent({ classId: classroom.id, firstName: 'Alan', lastName: 'Turing' });
  const handout = service.createMaterial({
    title: 'Scheda di prova C4',
    contentText: 'Esempi sintetici su SQL e risposte aperte.',
    pedagogicalRole: 'student_material',
    classId: classroom.id,
    subjectId: subject.id
  });
  service.publishMaterial(handout.id, { versionNumber: 1 });
  const assessment = service.createAssessment({
    title: 'Attività C4 browser — SQL',
    description: 'Prova sintetica non collegata a dati scolastici reali.',
    classId: classroom.id,
    subjectId: subject.id,
    status: 'active',
    durationMinutes: 45,
    maxScore: 30,
    items: [
      {
        type: 'open_short', questionText: 'Spiega a cosa serve una chiave primaria.', maxScore: 10,
        assessableSourceId: handout.id, assessableSourceVersion: 1,
        teacherSolution: 'Identifica univocamente ogni record.'
      },
      {
        type: 'code', questionText: 'Scrivi una query SQL di esempio.', language: 'sql', maxScore: 10,
        assessableSourceId: handout.id, assessableSourceVersion: 1,
        teacherSolution: 'SELECT ...'
      },
      {
        type: 'attachment', questionText: 'Allega un breve file SQL.', maxScore: 10,
        assessableSourceId: handout.id, assessableSourceVersion: 1,
        teacherSolution: 'CREATE TABLE ...'
      }
    ]
  });
  const credentials = service.listActivityCredentials(assessment.id);
  const credential1 = credentials.find(entry => entry.studentId === student1.id);
  const credential2 = credentials.find(entry => entry.studentId === student2.id);
  assert.ok(credential1?.accessCode);
  assert.ok(credential2?.accessCode);

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const keyId = `c4-browser-${process.pid}`;
  setTestAuthKeys({ keys: new Map([[keyId, crypto.createPublicKey(publicKey)]]) });
  const webAud = 'teacher-service-c4-browser-aud';
  const teacherEmail = 'teacher@school.example';
  const nowSec = Math.floor(Date.now() / 1000);
  const jwtHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyId })).toString('base64url');
  const jwtPayload = Buffer.from(JSON.stringify({
    iss: 'https://simogatti.cloudflareaccess.com',
    aud: [webAud],
    sub: teacherEmail,
    email: teacherEmail,
    nbf: nowSec - 10,
    iat: nowSec,
    exp: nowSec + 3600
  })).toString('base64url');
  const jwtBody = `${jwtHeader}.${jwtPayload}`;
  const teacherJwt = `${jwtBody}.${crypto.createSign('RSA-SHA256').update(jwtBody).sign(privateKey, 'base64url')}`;

  const app = await createHttpApp({
    service,
    teacherEmails: teacherEmail,
    authConfig: { webAud, expectedAud: webAud, allowSyntheticAuth: false }
  });
  let browser;
  let student1Context;
  let student2Context;
  let teacherContext;

  t.after(async () => {
    for (const context of [student1Context, student2Context, teacherContext]) {
      try { await context?.close(); } catch {}
    }
    try { await browser?.close(); } catch {}
    await app.close();
    clearJwksCache();
    setTestAuthKeys(null);
    fs.rmSync(runRoot, { recursive: true, force: true });
  });

  const { url } = await app.start(0, '127.0.0.1');
  browser = await chromium.launch({ headless: true });

  const student1Browser = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  student1Context = student1Browser;
  const browserErrors = [];
  const student1Page = await student1Browser.newPage();
  student1Page.on('pageerror', error => browserErrors.push(error.message));
  const firstNavigation = await student1Page.goto(`${url}/#/studente`);
  if (!(await student1Page.getByPlaceholder('A3F9X2').count())) {
    console.error('[C4 browser bootstrap]', { url, status: firstNavigation?.status(), title: await student1Page.title(), body: await student1Page.locator('body').innerText(), html: await student1Page.locator('body').innerHTML() });
  }
  await student1Page.getByPlaceholder('A3F9X2').fill(credential1.accessCode);
  await student1Page.getByRole('button', { name: /Accedi alla Prova/ }).click();
  await student1Page.getByRole('heading', { name: /Dichiarazione Postazione/ }).waitFor();
  await student1Page.getByRole('button', { name: /Conferma Postazione e Inizia Prova/ }).click();
  await student1Page.locator('.student-question-card').waitFor();
  assert.equal(await student1Page.getByRole('timer').count(), 1, 'Server-issued countdown is shown during the attempt');

  const student1Token = await student1Page.evaluate(() => sessionStorage.getItem('teacher_service_student_token'));
  const readOwnSubmission = async (page) => page.evaluate(async (assessmentId) => {
    const token = sessionStorage.getItem('teacher_service_student_token');
    const response = await fetch(`/api/student/activities/${assessmentId}/submission`, {
      headers: { 'X-Student-Token': token }
    });
    return response.json();
  }, assessment.id);
  const expiresAtBeforeReload = (await readOwnSubmission(student1Page)).submission.timer.expires_at;

  await student1Page.locator('.student-question-card textarea').fill('La chiave primaria identifica univocamente ogni riga.');
  await student1Page.getByRole('status').filter({ hasText: /Salvato \(Rev/ }).waitFor();
  await student1Page.locator('.question-dot').nth(1).click();
  const codeEditor = student1Page.getByRole('textbox', { name: 'Codice per quesito 2' });
  await codeEditor.fill('SELECT nome FROM studenti;');
  await codeEditor.press('End');
  await codeEditor.press('Tab');
  assert.match(await codeEditor.inputValue(), /  $/, 'Tab inserts two spaces in the lightweight code editor');
  await student1Page.getByRole('status').filter({ hasText: /Salvato \(Rev/ }).waitFor();

  await student1Page.locator('.question-dot').nth(2).click();
  await student1Page.locator('input[type="file"]').setInputFiles({
    name: 'schema.sql',
    mimeType: 'text/plain',
    buffer: Buffer.from('CREATE TABLE class_test (id INTEGER PRIMARY KEY);\n')
  });
  await student1Page.getByText(/schema.sql/).waitFor();
  await student1Page.getByRole('button', { name: 'Anteprima' }).click();
  await student1Page.getByText(/CREATE TABLE class_test/).waitFor();
  await student1Page.getByRole('button', { name: 'Chiudi anteprima' }).click();
  await student1Page.getByRole('status').filter({ hasText: /Salvato \(Rev/ }).waitFor();

  // Simulate a short network outage while keeping the compiled SPA reachable. A failed
  // server save must remain explicitly local, survive a page reload, and be reconciled.
  await student1Page.route('**/api/**', route => route.abort());
  await student1Page.locator('.question-dot').nth(0).click();
  await student1Page.locator('.student-question-card textarea').fill('Risposta aggiornata durante una breve interruzione Wi-Fi.');
  await student1Page.getByText('Solo su questo dispositivo').waitFor();
  await student1Page.getByRole('button', { name: /Errore salvataggio/ }).waitFor();
  await student1Page.reload();
  await student1Page.locator('.student-question-card textarea').waitFor();
  assert.equal(
    await student1Page.locator('.student-question-card textarea').inputValue(),
    'Risposta aggiornata durante una breve interruzione Wi-Fi.',
    'The IndexedDB draft restores after reload while API requests are unavailable'
  );
  await student1Page.unroute('**/api/**');
  await student1Page.getByRole('button', { name: /Salva Ora/ }).click();
  await student1Page.getByRole('status').filter({ hasText: /Salvato \(Rev/ }).waitFor();
  const expiresAtAfterReload = (await readOwnSubmission(student1Page)).submission.timer.expires_at;
  assert.equal(expiresAtAfterReload, expiresAtBeforeReload, 'Reload does not extend the server-owned deadline');

  // Exercise the actual 10- and 5-minute warnings without waiting an hour of wall time.
  await student1Page.clock.install({ time: new Date() });
  await student1Page.clock.fastForward(35 * 60 * 1000);
  await student1Page.getByRole('alert').filter({ hasText: 'Restano 10 minuti.' }).waitFor();
  await student1Page.clock.fastForward(5 * 60 * 1000);
  await student1Page.getByRole('alert').filter({ hasText: 'Restano 5 minuti.' }).waitFor();

  // A second student works in a separate browser session on tablet, then the same
  // interface is checked at desktop width. Student-local storage remains isolated.
  student2Context = await browser.newContext({ viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true });
  const student2Page = await student2Context.newPage();
  student2Page.on('pageerror', error => browserErrors.push(error.message));
  await student2Page.goto(`${url}/#/studente`);
  await student2Page.getByPlaceholder('A3F9X2').fill(credential2.accessCode);
  await student2Page.getByRole('button', { name: /Accedi alla Prova/ }).click();
  await student2Page.getByRole('heading', { name: /Dichiarazione Postazione/ }).waitFor();
  await student2Page.getByRole('button', { name: /Conferma Postazione e Inizia Prova/ }).click();
  await student2Page.locator('.student-question-card textarea').fill('La chiave primaria distingue ogni record.');
  await student2Page.getByRole('status').filter({ hasText: /Salvato \(Rev/ }).waitFor();
  await student2Page.setViewportSize({ width: 1365, height: 900 });
  const desktopLayout = await student2Page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth
  }));
  assert.ok(desktopLayout.pageWidth <= desktopLayout.viewportWidth + 1, `Desktop layout should not overflow horizontally: ${JSON.stringify(desktopLayout)}`);

  // Final submission must include the latest snapshot and reject a late write.
  await student1Page.getByRole('button', { name: /Consegna Definitiva Prova/ }).click();
  await student1Page.getByRole('heading', { name: /Conferma Consegna Definitiva/ }).waitFor();
  await student1Page.getByRole('button', { name: /Conferma e Consegna/ }).click();
  await student1Page.getByRole('heading', { name: /Prova Consegnata con Successo/ }).waitFor();
  const lateWrite = await student1Page.evaluate(async ({ assessmentId, assessmentItemId, token }) => {
    const response = await fetch(`/api/student/activities/${assessmentId}/autosave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Student-Token': token },
      body: JSON.stringify({ revision: 10000, responses: [{ itemId: assessmentItemId, responseText: 'late write' }] })
    });
    return response.status;
  }, { assessmentId: assessment.id, assessmentItemId: assessment.items[0].id, token: student1Token });
  assert.equal(lateWrite, 409, 'A request arriving after definitive submission is rejected');

  // Hold one real autosave before it reaches the server, submit the newer browser
  // snapshot, then release the stale request. The late 409 must not undo submission.
  let releaseDelayedAutosave;
  let markAutosaveHeld;
  const autosaveHeld = new Promise(resolve => { markAutosaveHeld = resolve; });
  await student2Page.route(`**/api/student/activities/${assessment.id}/autosave`, async route => {
    markAutosaveHeld();
    await new Promise(resolve => { releaseDelayedAutosave = resolve; });
    await route.continue();
  });
  await student2Page.locator('.question-dot').nth(1).click();
  await student2Page.getByRole('textbox', { name: 'Codice per quesito 2' }).fill('SELECT id FROM class_test;');
  await autosaveHeld;
  await student2Page.getByRole('button', { name: /Consegna Definitiva Prova/ }).click();
  await student2Page.getByRole('button', { name: /Conferma e Consegna/ }).click();
  await student2Page.getByRole('heading', { name: /Prova Consegnata con Successo/ }).waitFor();
  const delayedSaveResponse = student2Page.waitForResponse(response =>
    response.url().endsWith(`/api/student/activities/${assessment.id}/autosave`)
  );
  releaseDelayedAutosave();
  assert.equal((await delayedSaveResponse).status(), 409, 'A delayed autosave is rejected after the newer final snapshot');
  await student2Page.unroute(`**/api/student/activities/${assessment.id}/autosave`);
  assert.deepEqual(browserErrors, [], `No uncaught browser errors: ${browserErrors.join('; ')}`);

  teacherContext = await browser.newContext();
  await teacherContext.addCookies([{ name: 'CF_Authorization', value: teacherJwt, url }]);
  const teacherPage = await teacherContext.newPage();
  await teacherPage.goto(`${url}/`);
  const teacherView = await teacherPage.evaluate(async (assessmentId) => {
    const response = await fetch(`/api/assessments/${assessmentId}/submissions`);
    return { status: response.status, body: await response.json() };
  }, assessment.id);
  assert.equal(teacherView.status, 200, 'Authorized teacher can inspect the real HTTP submissions endpoint');
  assert.equal(teacherView.body.submissions.length, 2);
  const submitted1 = teacherView.body.submissions.find(submission => submission.student_id === student1.id);
  const submitted2 = teacherView.body.submissions.find(submission => submission.student_id === student2.id);
  assert.equal(submitted1.attempt_status, 'submitted');
  assert.equal(submitted2.attempt_status, 'submitted');
  const student1Answer = service.getStudentSubmission(assessment.id, student1.id, { role: 'teacher' });
  const student2Answer = service.getStudentSubmission(assessment.id, student2.id, { role: 'teacher' });
  assert.equal(student1Answer.responses.find(response => response.item_id === assessment.items[0].id).response_text, 'Risposta aggiornata durante una breve interruzione Wi-Fi.');
  assert.match(student1Answer.responses.find(response => response.item_id === assessment.items[1].id).response_text, /SELECT nome FROM studenti;\s{2}$/);
  assert.match(student1Answer.responses.find(response => response.item_id === assessment.items[2].id).attachment_name, /schema.sql/);
  assert.equal(student2Answer.responses.find(response => response.item_id === assessment.items[0].id).response_text, 'La chiave primaria distingue ogni record.');
  assert.equal(student2Answer.responses.find(response => response.item_id === assessment.items[1].id).response_text, 'SELECT id FROM class_test;');

  const phoneLayout = await student1Page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth
  }));
  const tabletLayout = await student2Page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth
  }));
  assert.ok(phoneLayout.pageWidth <= phoneLayout.viewportWidth + 1, `Phone layout should not overflow horizontally: ${JSON.stringify(phoneLayout)}`);
  assert.ok(tabletLayout.pageWidth <= tabletLayout.viewportWidth + 1, `Tablet layout should not overflow horizontally: ${JSON.stringify(tabletLayout)}`);
});
