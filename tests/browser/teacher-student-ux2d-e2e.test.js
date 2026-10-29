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
  const keyId = `ux2d-e2e-${process.pid}`;
  const email = 'ux2d-teacher@example.test';
  const audience = 'teacher-service-ux2d-e2e-aud';
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
    title: 'Relazioni e normalizzazione — UX2-D',
    date: '2026-11-06',
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
      title: `${title} — UX2-D`,
      contentText: resourceType === 'student_note'
        ? 'Versione 1: chiavi primarie e relazioni tra tabelle.'
        : `Contenuto sintetico per ${title.toLowerCase()} della lezione UX2-D.`,
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

function localDateTimeInput(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function eventCount(dbManager, resourceId, versionNumber) {
  return Number(dbManager.prepare(`
    SELECT COUNT(*) AS count FROM material_publication_events
    WHERE resource_id = ? AND version_number = ?
  `).get(resourceId, versionNumber).count);
}

test('UX2-D acceptance: teacher prepares and publishes, anonymous student consults, older versions can be withdrawn independently', async (t) => {
  const screenshotsDir = process.env.UX2D_SCREENSHOTS_DIR;
  if (screenshotsDir) fs.mkdirSync(screenshotsDir, { recursive: true });
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-ux2d-e2e-'));
  const dbManager = new DatabaseManager(path.join(runRoot, 'teacher.sqlite')).init();
  const fileStore = new FileStore(path.join(runRoot, 'files'));
  const service = new TeacherService({
    dbManager,
    fileStore,
    mockAi: true,
    classPinSecret: 'synthetic-ux2d-e2e-class-pin-secret-2026'
  });
  const classroom = service.createClass({ name: '4B Informatica — UX2-D', academicYear: '2026/2027' });
  const subject = service.createSubject({ classId: classroom.id, name: 'Basi di Dati' });
  const { lesson, materials } = createLessonPackFixture(service, classroom, subject);
  const studentMaterial = materials.student_note;

  const { token, email, audience } = makeTeacherJwt();
  const app = await createHttpApp({
    service,
    teacherEmails: email,
    authConfig: { webAud: audience, expectedAud: audience, allowSyntheticAuth: false }
  });

  let browser;
  let teacherContext;
  let secondTeacherContext;
  let studentContext;
  const pageErrors = [];
  const serverErrors = [];
  let capturedV1Publication = null;

  t.after(async () => {
    for (const context of [teacherContext, secondTeacherContext, studentContext]) {
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
      t.skip('Loopback non consentito dal runner; test E2E UX2-D non eseguito.');
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
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });
  await teacherPage.route('**/api/materials/*/versions/1/publication', async route => {
    if (route.request().method() === 'POST' && capturedV1Publication === null) {
      capturedV1Publication = route.request().postDataJSON();
    }
    await route.continue();
  });

  secondTeacherContext = await browser.newContext();
  await secondTeacherContext.addCookies([{ name: 'CF_Authorization', value: token, url }]);

  studentContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const studentPage = await studentContext.newPage();
  studentPage.on('pageerror', error => pageErrors.push(error.message));
  studentPage.on('response', response => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });

  const publicationPath = versionNumber =>
    `/api/materials/${encodeURIComponent(studentMaterial.id)}/versions/${versionNumber}/publication`;
  const studentMaterialPath = versionNumber =>
    `/api/student/classes/${encodeURIComponent(classroom.id)}/materials/${encodeURIComponent(studentMaterial.id)}/versions/${versionNumber}`;

  const openPreparation = async () => {
    await teacherPage.getByRole('button', { name: 'Preparazione', exact: true }).click();
    await teacherPage.locator('#lesson-select').waitFor();
    await teacherPage.waitForFunction(expectedId => document.querySelector('#lesson-select')?.value === expectedId, lesson.id);
    await teacherPage.locator('.lesson-card').waitFor();
  };

  const confirmPackage = async () => {
    await teacherPage.getByRole('button', { name: 'Conferma pacchetto' }).click();
    await teacherPage.getByRole('heading', { name: 'Conferma le versioni del pacchetto' }).waitFor();
    await teacherPage.getByRole('button', { name: 'Conferma pacchetto' }).last().click();
  };

  const openStudentClass = async () => {
    await studentPage.goto(`${url}/studente/classi/${encodeURIComponent(classroom.id)}`);
    await studentPage.locator('.public-class-portal').waitFor();
  };

  await teacherPage.goto(`${url}/docente`);
  await openPreparation();
  await teacherPage.locator('#preparation-availability .availability-state').waitFor();
  await teacherPage.locator('#preparation-availability').getByText('Mai pubblicata').waitFor();
  assert.equal(await teacherPage.locator('#preparation-availability').getByRole('button', { name: /Pubblica v1/ }).count(), 0,
    'an unconfirmed package must not expose the publish action');
  await teacherPage.getByText('La pubblicazione è disponibile solo dopo la revisione e la conferma della versione esatta nel pacchetto.').waitFor();

  await confirmPackage();
  await teacherPage.getByRole('button', { name: 'Pubblica v1 agli studenti' }).waitFor();

  const tomorrowNoon = new Date();
  tomorrowNoon.setDate(tomorrowNoon.getDate() + 1);
  tomorrowNoon.setHours(12, 0, 0, 0);
  const expiryInputValue = localDateTimeInput(tomorrowNoon);
  const expectedExpiryIso = new Date(expiryInputValue).toISOString();
  await teacherPage.locator('#publication-expiry').fill(expiryInputValue);
  await teacherPage.getByRole('button', { name: 'Pubblica v1 agli studenti' }).click();
  await teacherPage.getByRole('heading', { name: /Rendere visibile Dispensa studenti — UX2-D · v1/ }).waitFor();
  assert.equal(eventCount(dbManager, studentMaterial.id, 1), 0, 'opening the confirmation prompt must not publish');
  await teacherPage.getByRole('button', { name: 'Conferma pubblicazione' }).click();
  await teacherPage.locator('#preparation-availability .availability-state-available').waitFor();
  await teacherPage.getByText('La versione v1 è ora disponibile agli studenti.').waitFor();
  assert.equal(capturedV1Publication?.availableUntil, expectedExpiryIso,
    'the deadline must be sent as the UTC instant of the teacher local time');
  assert.equal(eventCount(dbManager, studentMaterial.id, 1), 1);

  await openStudentClass();
  await studentPage.getByText('1 pubblicati', { exact: true }).waitFor();
  await studentPage.locator('.public-material-link').filter({ hasText: 'Versione 1' }).click();
  await studentPage.getByText('Versione 1: chiavi primarie e relazioni tra tabelle.').waitFor();
  const v1Href = await studentPage.getByRole('link', { name: 'Scarica originale' }).getAttribute('href');
  const v1Download = await studentContext.request.get(`${url}${v1Href}`);
  assert.equal(v1Download.status(), 200);
  assert.match(await v1Download.text(), /Versione 1: chiavi primarie/);

  // Create v2 from the teacher UI and confirm the new package version.
  await teacherPage.locator('.artifact-nav-item').filter({ hasText: 'Dispensa studenti' }).click();
  await teacherPage.getByRole('button', { name: 'Modifica manuale' }).click();
  await teacherPage.locator('#artifact-content').waitFor();
  await teacherPage.locator('#artifact-content').fill('Versione 2: chiavi candidate, chiavi primarie e relazioni normalizzate.');
  await teacherPage.getByRole('button', { name: 'Salva come v2' }).click();
  await teacherPage.getByText('Versione corrente v2').waitFor();
  await teacherPage.locator('#preparation-availability').getByText('Mai pubblicata').waitFor();
  await teacherPage.getByRole('heading', { name: 'Altre versioni sono ancora disponibili' }).waitFor();
  assert.equal(await teacherPage.locator('#preparation-availability').getByRole('button', { name: /Pubblica v2/ }).count(), 0);

  await confirmPackage();
  await teacherPage.getByRole('button', { name: 'Pubblica v2 agli studenti' }).click();
  await teacherPage.getByRole('heading', { name: /Rendere visibile Dispensa studenti — UX2-D · v2/ }).waitFor();
  await teacherPage.getByRole('button', { name: 'Conferma pubblicazione' }).click();
  await teacherPage.locator('#preparation-availability .availability-state-available').waitFor();
  await teacherPage.getByText('La versione v2 è ora disponibile agli studenti.').waitFor();
  await teacherPage.getByRole('button', { name: 'Ritira v1' }).waitFor();
  assert.equal(eventCount(dbManager, studentMaterial.id, 1), 1);
  assert.equal(eventCount(dbManager, studentMaterial.id, 2), 1);

  await openStudentClass();
  await studentPage.getByText('2 pubblicati', { exact: true }).waitFor();
  await studentPage.locator('.public-material-link').filter({ hasText: 'Versione 2' }).click();
  await studentPage.getByText('Versione 2: chiavi candidate, chiavi primarie e relazioni normalizzate.').waitFor();
  const v2Href = await studentPage.getByRole('link', { name: 'Scarica originale' }).getAttribute('href');
  const v2Download = await studentContext.request.get(`${url}${v2Href}`);
  assert.equal(v2Download.status(), 200);
  assert.match(await v2Download.text(), /Versione 2: chiavi candidate/);

  // Responsive acceptance for both contexts while both versions are available.
  for (const width of [1024, 320]) {
    await teacherPage.setViewportSize({ width, height: 900 });
    await teacherPage.locator('#preparation-availability').scrollIntoViewIfNeeded();
    const layout = await teacherPage.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      offenders: [...document.querySelectorAll('*')]
        .map(element => ({ name: `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.right > window.innerWidth + 1)
        .slice(0, 8)
        .map(({ name, rect }) => `${name} right=${Math.round(rect.right)} width=${Math.round(rect.width)}`)
    }));
    assert.ok(layout.overflow <= 1, `teacher layout overflows horizontally at ${width}px by ${layout.overflow}px: ${layout.offenders.join(' | ')}`);
    await teacherPage.getByRole('button', { name: 'Ritira v1' }).waitFor();
    if (screenshotsDir) {
      await teacherPage.locator('#preparation-availability').screenshot({
        path: path.join(screenshotsDir, `availability-two-versions-${width}.png`)
      });
    }
  }
  await teacherPage.setViewportSize({ width: 1440, height: 1000 });

  for (const width of [1024, 320]) {
    await studentPage.setViewportSize({ width, height: 900 });
    await studentPage.getByText('Versione 2: chiavi candidate, chiavi primarie e relazioni normalizzate.').waitFor();
    const overflow = await studentPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `student reader overflows horizontally at ${width}px by ${overflow}px`);
    if (screenshotsDir) {
      await studentPage.screenshot({ path: path.join(screenshotsDir, `student-reader-${width}.png`), fullPage: true });
    }
    await openStudentClass();
    await studentPage.getByText('2 pubblicati', { exact: true }).waitFor();
    const classOverflow = await studentPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(classOverflow <= 1, `student class list overflows horizontally at ${width}px by ${classOverflow}px`);
    if (screenshotsDir) {
      await studentPage.screenshot({ path: path.join(screenshotsDir, `student-class-${width}.png`), fullPage: true });
    }
    await studentPage.goto(`${url}${studentMaterialPath(2)}`);
    await studentPage.getByText('Versione 2: chiavi candidate, chiavi primarie e relazioni normalizzate.').waitFor();
  }
  await studentPage.setViewportSize({ width: 1440, height: 1000 });

  // Withdraw the older v1 while v2 remains current and available.
  await teacherPage.getByRole('button', { name: 'Ritira v1' }).click();
  await teacherPage.getByRole('heading', { name: /Ritirare Dispensa studenti — UX2-D · v1/ }).waitFor();
  await teacherPage.getByRole('button', { name: 'Conferma ritiro' }).click();
  await teacherPage.getByText('La versione v1 è stata ritirata.').waitFor();
  await teacherPage.locator('#preparation-availability .availability-state-available').waitFor();
  assert.equal(eventCount(dbManager, studentMaterial.id, 1), 2);

  await openStudentClass();
  await studentPage.getByText('1 pubblicati', { exact: true }).waitFor();
  assert.equal(await studentPage.locator('.public-material-link').filter({ hasText: 'Versione 1' }).count(), 0);
  assert.equal((await studentContext.request.get(`${url}${v1Href}`)).status(), 404);

  // Concurrent session: v3 is published by a second teacher session, then expires
  // while the first session is confirming a withdrawal. The server must return 409.
  await teacherPage.getByRole('button', { name: 'Modifica manuale' }).click();
  await teacherPage.locator('#artifact-content').waitFor();
  await teacherPage.locator('#artifact-content').fill('Versione 3: bozza per il controllo di concorrenza.');
  await teacherPage.getByRole('button', { name: 'Salva come v3' }).click();
  await teacherPage.getByText('Versione corrente v3').waitFor();
  await teacherPage.getByRole('button', { name: 'Conferma pacchetto' }).click();
  await teacherPage.getByRole('heading', { name: 'Conferma le versioni del pacchetto' }).waitFor();
  await teacherPage.getByRole('button', { name: 'Conferma pacchetto' }).last().click();

  const publishV3 = await secondTeacherContext.request.post(`${url}${publicationPath(3)}`, {
    headers: { Origin: url },
    data: { availableUntil: null }
  });
  assert.equal(publishV3.status(), 201);
  assert.equal(eventCount(dbManager, studentMaterial.id, 3), 1);

  await teacherPage.reload();
  await openPreparation();
  await teacherPage.locator('#preparation-availability .availability-state-available').waitFor();
  await teacherPage.getByRole('button', { name: 'Ritira v3' }).click();
  await teacherPage.getByRole('heading', { name: /Ritirare Dispensa studenti — UX2-D · v3/ }).waitFor();

  const withdrawV3 = await secondTeacherContext.request.delete(`${url}${publicationPath(3)}`, {
    headers: { Origin: url }
  });
  assert.equal(withdrawV3.status(), 200);
  const republishV3Expiring = await secondTeacherContext.request.post(`${url}${publicationPath(3)}`, {
    headers: { Origin: url },
    data: { availableUntil: new Date(Date.now() + 1500).toISOString() }
  });
  assert.equal(republishV3Expiring.status(), 201);
  await new Promise(resolve => setTimeout(resolve, 1800));

  await teacherPage.getByRole('button', { name: 'Conferma ritiro' }).click();
  await teacherPage.locator('.publication-action-error').filter({ hasText: 'Lo stato è cambiato' }).waitFor();
  await teacherPage.locator('#preparation-availability').getByText('Pubblicazione scaduta').waitFor();
  assert.equal(eventCount(dbManager, studentMaterial.id, 3), 3,
    'a withdrawn then republished version keeps its append-only history');

  // Withdraw the last visible version; the student portal must become empty.
  await teacherPage.getByRole('button', { name: 'Ritira v2' }).click();
  await teacherPage.getByRole('heading', { name: /Ritirare Dispensa studenti — UX2-D · v2/ }).waitFor();
  await teacherPage.getByRole('button', { name: 'Conferma ritiro' }).click();
  await teacherPage.getByText('La versione v2 è stata ritirata.').waitFor();

  await openStudentClass();
  await studentPage.getByText('0 pubblicati', { exact: true }).waitFor();
  assert.equal(await studentPage.locator('.public-material-link').count(), 0);
  assert.equal((await studentContext.request.get(`${url}${v2Href}`)).status(), 404);

  await studentPage.goto(`${url}/studente/classi/${encodeURIComponent(classroom.id)}/materiali/${encodeURIComponent(studentMaterial.id)}/versions/2`);
  await studentPage.getByText('Questo materiale non è più disponibile: potrebbe essere stato ritirato o la scadenza è terminata.').waitFor();
  assert.equal(await studentPage.locator('.public-material-reader').count(), 0);

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(serverErrors, []);
});
