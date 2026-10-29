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

function makeTeacherJwt() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const keyId = `ux2c-browser-${process.pid}`;
  const email = 'ux2c-teacher@example.test';
  const audience = 'teacher-service-ux2c-browser-aud';
  setTestAuthKeys({ keys: new Map([[keyId, crypto.createPublicKey(publicKey)]]) });
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://simogatti.cloudflareaccess.com',
    aud: [audience],
    sub: email,
    email,
    nbf: now - 10,
    iat: now,
    exp: now + 3600
  })).toString('base64url');
  const body = `${header}.${payload}`;
  const token = `${body}.${crypto.createSign('RSA-SHA256').update(body).sign(privateKey, 'base64url')}`;
  return { token, email, audience };
}

function createLessonPackFixture(service, classroom, subject) {
  const lesson = service.createLesson({
    classId: classroom.id,
    subjectId: subject.id,
    title: 'Chiavi relazionali — UX2-C',
    date: '2026-11-05',
    durationMinutes: 60
  });
  const artifacts = [
    ['lesson_plan', 'teacher_material', 'Piano di lezione'],
    ['teacher_script', 'teacher_material', 'Copione docente'],
    ['exercise_sheet', 'support_material', 'Esercizi graduati'],
    ['student_note', 'student_material', 'Dispensa studenti']
  ];
  const materials = {};
  for (const [resourceType, pedagogicalRole, title] of artifacts) {
    const material = service.createMaterial({
      title: `${title} — UX2-C`,
      contentText: resourceType === 'student_note'
        ? 'Versione 1: chiavi primarie e relazioni tra tabelle.'
        : `Contenuto sintetico per ${title.toLowerCase()} della lezione UX2-C.`,
      resourceType,
      pedagogicalRole,
      classId: classroom.id,
      subjectId: subject.id,
      lessonId: lesson.id
    });
    materials[resourceType] = material;
  }
  return { lesson, materials };
}

test('UX2-C browser: review, package confirmation, explicit version publication, student visibility and withdrawal', async (t) => {
  const screenshotsDir = process.env.UX2C_SCREENSHOTS_DIR;
  if (screenshotsDir) fs.mkdirSync(screenshotsDir, { recursive: true });
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-ux2c-browser-'));
  const dbManager = new DatabaseManager(path.join(runRoot, 'teacher.sqlite')).init();
  const fileStore = new FileStore(path.join(runRoot, 'files'));
  const service = new TeacherService({
    dbManager,
    fileStore,
    mockAi: true,
    classPinSecret: 'synthetic-ux2c-browser-class-pin-secret-2026'
  });
  const classroom = service.createClass({ name: '3A Informatica — UX2-C', academicYear: '2026/2027' });
  const subject = service.createSubject({ classId: classroom.id, name: 'Basi di Dati' });
  const { lesson, materials } = createLessonPackFixture(service, classroom, subject);
  const studentMaterial = materials.student_note;

  // Fixture only: an older immutable version is already public. UX2-C operates on v2
  // and proves that publishing or withdrawing one version leaves the other untouched.
  service.publishMaterial(studentMaterial.id, { versionNumber: 1, publishedBy: 'synthetic-fixture-teacher' });

  const { token, email, audience } = makeTeacherJwt();
  const app = await createHttpApp({
    service,
    teacherEmails: email,
    authConfig: { webAud: audience, expectedAud: audience, allowSyntheticAuth: false }
  });
  let browser;
  let teacherContext;
  let studentContext;
  const pageErrors = [];
  const serverErrors = [];
  const expectedInjectedFailures = new Set();
  let releaseInitialPublication;
  const initialPublicationGate = new Promise(resolve => { releaseInitialPublication = resolve; });
  let publicationReadCount = 0;
  let conflictRemaining = true;

  t.after(async () => {
    for (const context of [teacherContext, studentContext]) {
      try { await context?.close(); } catch {}
    }
    try { await browser?.close(); } catch {}
    await app.close();
    clearJwksCache();
    setTestAuthKeys(null);
    fs.rmSync(runRoot, { recursive: true, force: true });
  });

  let started;
  try {
    started = await app.start(0, '127.0.0.1');
  } catch (error) {
    if (error?.code === 'EPERM') {
      t.skip('Loopback non consentito dal runner; test browser UX2-C non eseguito.');
      return;
    }
    throw error;
  }

  browser = await chromium.launch({ headless: true });
  const url = started.url;
  teacherContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await teacherContext.addCookies([{ name: 'CF_Authorization', value: token, url }]);
  const teacherPage = await teacherContext.newPage();
  teacherPage.on('pageerror', error => pageErrors.push(error.message));
  teacherPage.on('response', response => {
    if (response.status() >= 500 && !expectedInjectedFailures.delete(response.url())) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  await teacherPage.route('**/api/materials/*/versions/*/publication', async route => {
    if (route.request().method() === 'GET' && publicationReadCount++ === 0) {
      await initialPublicationGate;
      expectedInjectedFailures.add(route.request().url());
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Errore temporaneo UX2-C' }) });
      return;
    }
    if (route.request().method() === 'POST' && conflictRemaining) {
      conflictRemaining = false;
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'Conflitto sintetico UX2-C' }) });
      return;
    }
    await route.continue();
  });

  studentContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const studentPage = await studentContext.newPage();
  studentPage.on('pageerror', error => pageErrors.push(error.message));
  studentPage.on('response', response => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });

  await teacherPage.goto(`${url}/docente`);
  await teacherPage.getByRole('button', { name: 'Preparazione', exact: true }).click();
  await teacherPage.locator('#lesson-select').waitFor();
  await teacherPage.waitForFunction(expectedId => document.querySelector('#lesson-select')?.value === expectedId, lesson.id);
  await teacherPage.locator('.lesson-card').waitFor();
  await teacherPage.getByText('Verifica dello stato reale…').waitFor();
  releaseInitialPublication();
  await teacherPage.getByText('Stato non verificabile').waitFor();
  assert.equal(await teacherPage.locator('#preparation-availability').getByRole('button', { name: /Pubblica|Ritira/ }).count(), 0,
    'publication actions must remain hidden while the server state is unknown');
  await teacherPage.getByRole('button', { name: 'Riprova a verificare' }).click();
  await teacherPage.locator('#preparation-availability .availability-state-available').waitFor();
  await teacherPage.locator('.artifact-nav-item').filter({ hasText: 'Dispensa studenti' }).click();
  await teacherPage.locator('.artifact-nav-item.active').filter({ hasText: 'Dispensa studenti' }).waitFor();
  assert.match(await teacherPage.locator('.workspace-pane').innerText(), /Versione 1: chiavi primarie/);

  await teacherPage.getByRole('button', { name: 'Modifica manuale' }).click();
  await teacherPage.locator('#artifact-content').waitFor();
  await teacherPage.locator('#artifact-content').fill('Versione 2: chiavi candidate, chiavi primarie e relazioni normalizzate.');
  await teacherPage.getByRole('button', { name: 'Salva come v2' }).click();
  await teacherPage.getByText('Versione corrente v2').waitFor();
  await teacherPage.locator('#preparation-availability').getByText('Mai pubblicata').waitFor();
  await teacherPage.getByRole('heading', { name: 'Altre versioni sono ancora disponibili' }).waitFor();
  assert.equal(dbManager.prepare('SELECT COUNT(*) AS count FROM material_publication_events').get().count, 1,
    'creating v2 must not inherit or rewrite the existing v1 publication');
  assert.equal(service.getVersionPublicationStatus(studentMaterial.id, 2).status, 'never_published');
  assert.equal(await teacherPage.locator('#preparation-availability').getByRole('button', { name: /Pubblica v2/ }).count(), 0,
    'unconfirmed v2 must not expose the publish action');
  if (screenshotsDir) {
    await teacherPage.locator('#preparation-availability').screenshot({ path: path.join(screenshotsDir, 'draft-v2-and-available-v1-1440.png') });
  }

  // The anonymous portal sees only the already-published v1 while v2 is still a draft.
  await studentPage.goto(`${url}/studente/classi/${encodeURIComponent(classroom.id)}`);
  await studentPage.getByText('1 pubblicati', { exact: true }).waitFor();
  assert.equal(await studentPage.locator('.public-material-link').filter({ hasText: 'Versione 2' }).count(), 0);
  assert.equal(await studentPage.locator('.public-material-link').filter({ hasText: 'Versione 1' }).count(), 1);

  await teacherPage.getByRole('button', { name: 'Conferma pacchetto' }).click();
  const confirmationHeading = teacherPage.getByRole('heading', { name: 'Conferma le versioni del pacchetto' });
  await confirmationHeading.waitFor();
  const confirmationDialog = teacherPage.locator('.modal-content');
  assert.match(await confirmationDialog.innerText(), /Dispensa studenti\s+v2/);
  assert.match(await confirmationDialog.innerText(), /non pubblica i materiali/);
  await teacherPage.getByRole('button', { name: 'Conferma pacchetto' }).last().click();
  await confirmationHeading.waitFor({ state: 'hidden' });
  await teacherPage.locator('.artifact-version-state.confirmed')
    .filter({ hasText: 'Inclusa nell’ultima conferma del pacchetto' }).waitFor();
  await teacherPage.locator('#preparation-availability').getByText('Mai pubblicata').waitFor();
  assert.equal(dbManager.prepare('SELECT COUNT(*) AS count FROM material_publication_events').get().count, 1,
    'package confirmation must not append a publication event');
  assert.equal(service.getVersionPublicationStatus(studentMaterial.id, 2).status, 'never_published');
  await teacherPage.getByRole('link', { name: /Disponibilità/ }).click();
  await teacherPage.getByRole('button', { name: 'Pubblica v2 agli studenti' }).waitFor();

  await teacherPage.getByRole('button', { name: 'Pubblica v2 agli studenti' }).click();
  await teacherPage.getByRole('heading', { name: /Rendere visibile Dispensa studenti — UX2-C · v2/ }).waitFor();
  assert.equal(dbManager.prepare('SELECT COUNT(*) AS count FROM material_publication_events').get().count, 1,
    'opening the confirmation prompt must not publish');
  await teacherPage.getByRole('button', { name: 'Conferma pubblicazione' }).click();
  await teacherPage.locator('.publication-action-error').filter({ hasText: 'Lo stato è cambiato' }).waitFor();
  await teacherPage.locator('#preparation-availability').getByText('Mai pubblicata').waitFor();
  assert.equal(dbManager.prepare('SELECT COUNT(*) AS count FROM material_publication_events').get().count, 1,
    'a publication conflict must not append an event');
  await teacherPage.getByRole('button', { name: 'Pubblica v2 agli studenti' }).click();
  await teacherPage.getByRole('heading', { name: /Rendere visibile Dispensa studenti — UX2-C · v2/ }).waitFor();
  await teacherPage.getByRole('button', { name: 'Conferma pubblicazione' }).click();
  await teacherPage.locator('#preparation-availability .availability-state-available').waitFor();
  await teacherPage.getByText('La versione v2 è ora disponibile agli studenti.').waitFor();
  await teacherPage.getByRole('heading', { name: 'Altre versioni sono ancora disponibili' }).waitFor();
  assert.equal(dbManager.prepare('SELECT COUNT(*) AS count FROM material_publication_events').get().count, 2);
  assert.equal(service.getVersionPublicationStatus(studentMaterial.id, 2).status, 'available');
  assert.equal(service.getVersionPublicationStatus(studentMaterial.id, 1).status, 'available');
  if (screenshotsDir) {
    await teacherPage.locator('#preparation-availability').screenshot({ path: path.join(screenshotsDir, 'published-v2-with-v1-desktop-1440.png') });
  }

  // Responsive visual evidence of the available state with v1 still listed.
  for (const viewport of [
    { width: 768, height: 1024, name: 'tablet-768' },
    { width: 390, height: 844, name: 'mobile-390' }
  ]) {
    await teacherPage.setViewportSize({ width: viewport.width, height: viewport.height });
    assert.equal(await teacherPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true,
      `${viewport.name} publication panel must not cause horizontal scrolling`);
    await teacherPage.getByRole('link', { name: /Disponibilità/ }).click();
    const layout = await teacherPage.locator('#preparation-availability').evaluate(node => ({
      panelColumns: getComputedStyle(node).gridTemplateColumns,
      stateBottom: node.querySelector('.availability-state').getBoundingClientRect().bottom,
      detailsTop: node.querySelector('.availability-details').getBoundingClientRect().top,
      actionWidth: node.querySelector('.publication-withdraw-actions .btn').getBoundingClientRect().width,
      panelWidth: node.getBoundingClientRect().width,
      panelTop: node.getBoundingClientRect().top,
      flowBottom: document.querySelector('.preparation-flow-nav').getBoundingClientRect().bottom
    }));
    assert.equal(layout.panelColumns.split(' ').length, 1, `${viewport.name} availability content should stack`);
    assert.ok(layout.detailsTop >= layout.stateBottom, `${viewport.name} details should follow the state`);
    if (viewport.width <= 420) assert.ok(layout.actionWidth >= layout.panelWidth - 36, 'mobile withdrawal action should be full width');
    assert.ok(layout.panelTop >= layout.flowBottom - 1, `${viewport.name} destination should remain visible below the sticky preparation navigation`);
    if (screenshotsDir) {
      await teacherPage.screenshot({ path: path.join(screenshotsDir, `published-v2-with-v1-${viewport.name}.png`), fullPage: false });
    }
  }
  await teacherPage.setViewportSize({ width: 1440, height: 1000 });

  await studentPage.goto(`${url}/studente/classi/${encodeURIComponent(classroom.id)}`);
  await studentPage.getByText('2 pubblicati', { exact: true }).waitFor();
  assert.equal(await studentPage.locator('.public-material-link').filter({ hasText: 'Versione 1' }).count(), 1);
  assert.equal(await studentPage.locator('.public-material-link').filter({ hasText: 'Versione 2' }).count(), 1);
  await studentPage.locator('.public-material-link').filter({ hasText: 'Versione 2' }).click();
  await studentPage.getByRole('heading', { name: 'Dispensa studenti — UX2-C' }).waitFor();
  await studentPage.locator('.public-material-reader').waitFor();
  assert.match(await studentPage.locator('.public-material-reader').innerText(), /Versione 2: chiavi candidate/);
  if (screenshotsDir) await studentPage.screenshot({ path: path.join(screenshotsDir, 'student-v2-visible-1440.png'), fullPage: true });
  await studentPage.getByRole('button', { name: /3A Informatica/ }).click();
  await studentPage.getByText('2 pubblicati', { exact: true }).waitFor();
  await studentPage.locator('.public-material-link').filter({ hasText: 'Versione 1' }).click();
  await studentPage.locator('.public-material-reader').waitFor();
  assert.match(await studentPage.locator('.public-material-reader').innerText(), /Versione 1: chiavi primarie/);

  await teacherPage.locator('#preparation-availability').scrollIntoViewIfNeeded();
  await teacherPage.getByRole('button', { name: 'Ritira v2' }).click();
  await teacherPage.getByRole('heading', { name: /Ritirare Dispensa studenti — UX2-C · v2/ }).waitFor();
  assert.equal(dbManager.prepare('SELECT COUNT(*) AS count FROM material_publication_events').get().count, 2,
    'opening the withdrawal confirmation must not change publication history');
  await teacherPage.getByRole('button', { name: 'Conferma ritiro' }).click();
  await teacherPage.locator('#preparation-availability .availability-state-withdrawn').waitFor();
  await teacherPage.getByText('La versione v2 è stata ritirata.').waitFor();
  assert.equal(dbManager.prepare('SELECT COUNT(*) AS count FROM material_publication_events').get().count, 3);
  assert.equal(service.getVersionPublicationStatus(studentMaterial.id, 2).status, 'withdrawn');
  assert.equal(service.getVersionPublicationStatus(studentMaterial.id, 1).status, 'available');
  if (screenshotsDir) {
    await teacherPage.locator('#preparation-availability').screenshot({ path: path.join(screenshotsDir, 'withdrawn-v2-with-v1-desktop-1440.png') });
  }

  await studentPage.goto(`${url}/studente/classi/${encodeURIComponent(classroom.id)}`);
  await studentPage.getByText('1 pubblicati', { exact: true }).waitFor();
  assert.equal(await studentPage.locator('.public-material-link').filter({ hasText: 'Versione 2' }).count(), 0,
    'withdrawn v2 must disappear from the anonymous student list');
  assert.equal(await studentPage.locator('.public-material-link').filter({ hasText: 'Versione 1' }).count(), 1,
    'withdrawing v2 must leave v1 publicly available');
  const withdrawnVersionUrl = `${url}/studente/classi/${encodeURIComponent(classroom.id)}/materiali/${encodeURIComponent(studentMaterial.id)}/versions/2`;
  const withdrawnResponse = await studentPage.goto(withdrawnVersionUrl);
  assert.equal(withdrawnResponse?.status(), 200, 'the portal shell remains reachable for a withdrawn deep link');
  await studentPage.getByRole('alert').waitFor();
  assert.equal(await studentPage.locator('.public-material-reader').count(), 0,
    'withdrawn v2 content must not be rendered to an anonymous student');
  await studentPage.goto(`${url}/studente/classi/${encodeURIComponent(classroom.id)}`);
  await studentPage.locator('.public-material-link').filter({ hasText: 'Versione 1' }).click();
  await studentPage.locator('.public-material-reader').waitFor();
  assert.match(await studentPage.locator('.public-material-reader').innerText(), /Versione 1: chiavi primarie/);

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(serverErrors, []);
});
