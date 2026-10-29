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

function makeTeacherJwt() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const keyId = `ux2b-browser-${process.pid}`;
  setTestAuthKeys({ keys: new Map([[keyId, crypto.createPublicKey(publicKey)]]) });
  const email = 'ux2b-teacher@example.test';
  const nowSec = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://simogatti.cloudflareaccess.com',
    aud: ['teacher-service-ux2b-browser-aud'],
    sub: email,
    email,
    nbf: nowSec - 10,
    iat: nowSec,
    exp: nowSec + 3600
  })).toString('base64url');
  const body = `${header}.${payload}`;
  const token = `${body}.${crypto.createSign('RSA-SHA256').update(body).sign(privateKey, 'base64url')}`;
  return { token, email };
}

async function textContrastRatio(locator) {
  return locator.evaluate(element => {
    const parseColor = value => {
      const channels = value.match(/[\d.]+/g)?.map(Number) || [];
      return channels.length >= 3 ? channels.slice(0, 3) : [0, 0, 0];
    };
    const luminance = ([r, g, b]) => {
      const linear = channel => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      const [red, green, blue] = [r, g, b].map(linear);
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const foreground = luminance(parseColor(getComputedStyle(element).color));
    let backgroundNode = element;
    let background = [255, 255, 255];
    while (backgroundNode) {
      const color = getComputedStyle(backgroundNode).backgroundColor;
      const channels = color.match(/[\d.]+/g)?.map(Number) || [];
      if (channels.length >= 3 && (channels[3] ?? 1) > 0) {
        background = channels.slice(0, 3);
        break;
      }
      backgroundNode = backgroundNode.parentElement;
    }
    const backgroundLuminance = luminance(background);
    const [lighter, darker] = [foreground, backgroundLuminance].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  });
}

function createLessonPackFixture(service, classroom, subject, suffix) {
  const lesson = service.createLesson({
    classId: classroom.id,
    subjectId: subject.id,
    title: `Chiavi relazionali — ${suffix}`,
    date: '2026-11-05',
    durationMinutes: 60
  });
  const artifacts = [
    ['lesson_plan', 'teacher_material', 'Piano di lezione'],
    ['teacher_script', 'teacher_material', 'Copione docente'],
    ['exercise_sheet', 'support_material', 'Esercizi graduati'],
    ['student_note', 'student_material', 'Dispensa studenti']
  ];
  for (const [resourceType, pedagogicalRole, title] of artifacts) {
    service.createMaterial({
      title: `${title} — ${suffix}`,
      contentText: `Contenuto sintetico per ${title.toLowerCase()} della lezione ${suffix}.`,
      resourceType,
      pedagogicalRole,
      classId: classroom.id,
      subjectId: subject.id,
      lessonId: lesson.id
    });
  }
  return lesson;
}

test('UX2-B teacher preparation journey: context, version review and student availability boundary', async (t) => {
  const screenshotsDir = process.env.UX2B_SCREENSHOTS_DIR;
  if (screenshotsDir) fs.mkdirSync(screenshotsDir, { recursive: true });
  const runRoot = path.resolve(process.cwd(), '.tmp', 'dev-preview', `ux2b-browser-${process.pid}-${Date.now()}`);
  fs.mkdirSync(runRoot, { recursive: true });
  const dbManager = new DatabaseManager(path.join(runRoot, 'teacher-ux2b.sqlite')).init();
  const fileStore = new FileStore(path.join(runRoot, 'filestore'));
  const service = new TeacherService({
    dbManager,
    fileStore,
    mockAi: true,
    classPinSecret: 'synthetic-ux2b-browser-class-pin-secret-2026'
  });

  const classA = service.createClass({ name: '3A Informatica — UX2B', academicYear: '2026/2027' });
  const subjectA = service.createSubject({ classId: classA.id, name: 'Basi di Dati' });
  const lessonA = createLessonPackFixture(service, classA, subjectA, 'A');
  service.createMaterial({
    title: 'Fonte sintetica — chiavi e relazioni',
    contentText: 'Una chiave primaria identifica una riga; una chiave esterna collega tabelle.',
    resourceType: 'reference_source',
    pedagogicalRole: 'support_material',
    classId: classA.id,
    subjectId: subjectA.id,
    lessonId: lessonA.id
  });
  service.confirmLessonPreparation({ lessonId: lessonA.id, notes: 'Conferma fixture sintetica UX2-B', actorId: 'ux2b-teacher' });

  const classB = service.createClass({ name: '5B Informatica — UX2B', academicYear: '2026/2027' });
  const subjectB = service.createSubject({ classId: classB.id, name: 'Reti' });
  const lessonB = service.createLesson({
    classId: classB.id,
    subjectId: subjectB.id,
    title: 'Indirizzamento IP — B',
    date: '2026-11-12',
    durationMinutes: 45
  });

  const { token, email } = makeTeacherJwt();
  const app = await createHttpApp({
    service,
    teacherEmails: email,
    authConfig: { webAud: 'teacher-service-ux2b-browser-aud', expectedAud: 'teacher-service-ux2b-browser-aud', allowSyntheticAuth: false }
  });
  let browser;
  let teacherContext;
  let mobileContext;
  const pageErrors = [];
  const serverErrors = [];
  const expectedInjectedFailures = new Set();
  const observedWrites = [];
  const responsePayloads = [];

  t.after(async () => {
    for (const context of [teacherContext, mobileContext]) {
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
      t.skip('Sandbox policy denied loopback bind; run the synthetic UX2-B browser test on the host.');
      return;
    }
    throw error;
  }

  browser = await chromium.launch({ headless: true });
  const url = started.url;
  teacherContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await teacherContext.addCookies([{ name: 'CF_Authorization', value: token, url }]);
  const teacherPage = await teacherContext.newPage();
  teacherPage.on('pageerror', error => pageErrors.push(error.message));
  teacherPage.on('response', response => {
    if (response.status() >= 500 && !expectedInjectedFailures.delete(response.url())) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
    if (response.url().includes('/api/lessons/') && response.url().endsWith('/confirm-preparation')) {
      response.json().then(payload => responsePayloads.push(payload)).catch(() => {});
    }
  });
  teacherPage.on('request', request => {
    if (request.method() !== 'GET') observedWrites.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });

  let packFailuresRemaining = 1;
  await teacherPage.route('**/api/lessons/*/pack', async route => {
    if (packFailuresRemaining > 0) {
      packFailuresRemaining -= 1;
      expectedInjectedFailures.add(route.request().url());
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Errore sintetico temporaneo' }) });
      return;
    }
    await route.continue();
  });

  await teacherPage.goto(`${url}/docente`);
  await teacherPage.getByRole('button', { name: 'Preparazione', exact: true }).click();
  await teacherPage.locator('#class-select').waitFor();
  await teacherPage.waitForFunction(expectedId => document.querySelector('#lesson-select')?.value === expectedId, lessonA.id);
  await teacherPage.getByRole('alert').filter({ hasText: 'Il pacchetto non è disponibile' }).waitFor();
  if (screenshotsDir) await teacherPage.screenshot({ path: path.join(screenshotsDir, 'after-preparation-load-error-desktop-1440.png') });
  await teacherPage.getByRole('button', { name: 'Riprova caricamento' }).click();
  await teacherPage.locator('.lesson-card').waitFor();
  await teacherPage.waitForFunction(() => document.querySelector('.lesson-card')?.textContent.includes('Preparazione Confermata'));

  assert.equal(await teacherPage.locator('#class-select').inputValue(), classA.id);
  assert.equal(await teacherPage.locator('#subject-select').inputValue(), subjectA.id);
  assert.equal(await teacherPage.locator('#lesson-select').inputValue(), lessonA.id);
  assert.match(await teacherPage.locator('.context-current').innerText(), /3A Informatica.*Basi di Dati.*Chiavi relazionali/);
  assert.match(await teacherPage.locator('.preparation-sticky-context').innerText(), /3A Informatica.*Basi di Dati.*Chiavi relazionali/);
  assert.equal(await teacherPage.locator('.preparation-flow-nav').evaluate(node => getComputedStyle(node).position), 'sticky');
  assert.equal(await teacherPage.locator('.lesson-card #btn-confirm-prep').count(), 0, 'confirmation is not offered before artifact review');
  assert.equal(await teacherPage.locator('#preparation-review #btn-confirm-prep').count(), 1, 'confirmation follows the artifact review');

  const flowNav = teacherPage.locator('.preparation-flow-nav a');
  const flowLinks = await flowNav.evaluateAll(links => links.map(link => link.getAttribute('href')));
  assert.deepEqual(flowLinks, ['#preparation-context', '#preparation-sources', '#preparation-materials', '#preparation-review', '#preparation-availability']);
  await flowNav.first().focus();
  await teacherPage.keyboard.press('Tab');
  const keyboardFocus = await teacherPage.evaluate(() => ({
    label: document.activeElement.textContent.trim(),
    outlineStyle: getComputedStyle(document.activeElement).outlineStyle,
    outlineWidth: getComputedStyle(document.activeElement).outlineWidth
  }));
  assert.match(keyboardFocus.label, /Fonti/);
  assert.equal(keyboardFocus.outlineStyle, 'solid');
  assert.notEqual(keyboardFocus.outlineWidth, '0px');
  assert.equal(await teacherPage.locator('#preparation-availability').getByText('Mai pubblicata').count(), 1);
  await teacherPage.locator('#preparation-availability').getByRole('button', { name: /Pubblica v1 agli studenti/ }).waitFor();
  assert.equal(dbManager.prepare('SELECT COUNT(*) AS count FROM material_publication_events').get().count, 0, 'showing an allowed action must not publish');
  assert.ok(await textContrastRatio(teacherPage.locator('.preparation-confirmation-copy p:last-child')) >= 4.5, 'confirmation guidance meets AA text contrast');
  assert.ok(await textContrastRatio(teacherPage.locator('#preparation-availability .availability-state p:last-child')) >= 4.5, 'availability guidance meets AA text contrast');

  const sourceTitles = await teacherPage.locator('.source-title').allTextContents();
  assert.deepEqual(sourceTitles, ['Fonte sintetica — chiavi e relazioni']);
  assert.equal(await teacherPage.locator('.step-item.version-confirmed').count(), 4);
  assert.equal(await teacherPage.locator('.step-item.version-draft').count(), 0);
  assert.equal(await teacherPage.locator('.step-item').count(), 4);
  assert.match(await teacherPage.locator('.artifact-version-state').innerText(), /Inclusa nell’ultima conferma/);

  await teacherPage.locator('.source-choice input').first().check();
  await teacherPage.locator('#class-select').selectOption(classB.id);
  const inputGuard = teacherPage.getByRole('alertdialog', { name: 'Modifiche non salvate' });
  await inputGuard.waitFor();
  await teacherPage.keyboard.press('Escape');
  assert.equal(await teacherPage.locator('#class-select').inputValue(), classA.id);
  assert.equal(await teacherPage.locator('.source-choice input').first().isChecked(), true);

  await teacherPage.locator('#class-select').selectOption(classB.id);
  await teacherPage.getByRole('alertdialog').waitFor();
  await teacherPage.getByRole('button', { name: 'Scarta e continua' }).click();
  await teacherPage.waitForFunction(expectedId => document.querySelector('#class-select')?.value === expectedId, classB.id);
  await teacherPage.waitForFunction(expectedId => document.querySelector('#subject-select')?.value === expectedId, subjectB.id);
  await teacherPage.waitForFunction(expectedId => document.querySelector('#lesson-select')?.value === expectedId, lessonB.id);
  assert.match(await teacherPage.locator('.context-current').innerText(), /5B Informatica.*Reti.*Indirizzamento IP/);

  await teacherPage.locator('#class-select').selectOption(classA.id);
  await teacherPage.waitForFunction(expectedId => document.querySelector('#class-select')?.value === expectedId, classA.id);
  await teacherPage.waitForFunction(expectedId => document.querySelector('#subject-select')?.value === expectedId, subjectA.id);
  await teacherPage.waitForFunction(expectedId => document.querySelector('#lesson-select')?.value === expectedId, lessonA.id);
  await teacherPage.locator('.lesson-card').waitFor();

  await teacherPage.getByRole('button', { name: 'Modifica manuale' }).click();
  const editor = teacherPage.locator('#artifact-content');
  const firstDraft = 'Contenuto sintetico della bozza UX2-B da non perdere.';
  await editor.fill(firstDraft);
  assert.equal(await teacherPage.locator('.workspace-pane').evaluate(node => node.classList.contains('workspace-pane-editing')), true);
  assert.ok(await teacherPage.locator('.workspace-pane').evaluate(node => node.getBoundingClientRect().height >= 600), 'editor keeps a usable writing area');
  await teacherPage.locator('.artifact-nav-item').filter({ hasText: 'Copione docente' }).click();
  const artifactGuard = teacherPage.getByRole('alertdialog');
  await artifactGuard.waitFor();
  await teacherPage.getByRole('button', { name: 'Resta nella bozza' }).click();
  assert.equal(await editor.inputValue(), firstDraft);
  assert.match(await teacherPage.locator('.artifact-nav-item.active').innerText(), /Piano di lezione/);
  await teacherPage.locator('.artifact-nav-item').filter({ hasText: 'Copione docente' }).click();
  await teacherPage.getByRole('button', { name: 'Scarta e continua' }).click();
  await teacherPage.locator('.artifact-nav-item.active').filter({ hasText: 'Copione docente' }).waitFor();
  await teacherPage.locator('.artifact-nav-item').filter({ hasText: 'Piano di lezione' }).click();

  await teacherPage.getByRole('button', { name: 'Modifica manuale' }).click();
  await teacherPage.locator('#artifact-content').fill('Revisione manuale sintetica UX2-B: contenuto aggiornato del piano di lezione versione 2.');
  await teacherPage.getByRole('button', { name: 'Salva come v2' }).click();
  await teacherPage.getByText('Versione corrente v2').waitFor();
  await teacherPage.getByText('Nuova bozza · non inclusa nell’ultima conferma').waitFor();
  await teacherPage.locator('.step-item.version-draft').filter({ hasText: 'Piano di lezione' }).waitFor();
  await teacherPage.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await teacherPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'desktop layout should not scroll horizontally');
  const draftColors = await teacherPage.evaluate(() => ({
    draft: getComputedStyle(document.querySelector('.step-item.version-draft')).backgroundColor,
    confirmed: getComputedStyle(document.querySelector('.step-item.version-confirmed')).backgroundColor
  }));
  assert.notEqual(draftColors.draft, draftColors.confirmed, 'unconfirmed drafts should not share the confirmed green surface');
  assert.ok(await teacherPage.locator('.workspace-pane').evaluate(node => node.getBoundingClientRect().height < 500), 'read-only review should fit its preview content instead of reserving a full editor height');
  if (screenshotsDir) {
    await teacherPage.evaluate(() => window.scrollTo(0, 0));
    await teacherPage.screenshot({ path: path.join(screenshotsDir, 'after-preparation-desktop-1440.png'), fullPage: true });
  }

  await teacherPage.setViewportSize({ width: 768, height: 1024 });
  assert.equal(await teacherPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'tablet layout should not scroll horizontally');
  const tabletReviewLayout = await teacherPage.evaluate(() => {
    const nav = document.querySelector('.artifact-tabs').getBoundingClientRect();
    const pane = document.querySelector('.workspace-pane').getBoundingClientRect();
    return { navBottom: nav.bottom, paneTop: pane.top };
  });
  assert.ok(tabletReviewLayout.paneTop >= tabletReviewLayout.navBottom - 1, 'tablet review workspace should stack below the version list');
  await teacherPage.evaluate(() => window.scrollTo(0, 0));
  if (screenshotsDir) await teacherPage.screenshot({ path: path.join(screenshotsDir, 'after-preparation-tablet-768.png'), fullPage: true });

  mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await mobileContext.addCookies([{ name: 'CF_Authorization', value: token, url }]);
  const mobilePage = await mobileContext.newPage();
  mobilePage.on('pageerror', error => pageErrors.push(error.message));
  await mobilePage.goto(`${url}/docente`);
  await mobilePage.locator('.teacher-mobile-nav select').selectOption('prep');
  await mobilePage.waitForFunction(expectedId => document.querySelector('#lesson-select')?.value === expectedId, lessonA.id);
  await mobilePage.getByText('Nuova bozza · non inclusa nell’ultima conferma').waitFor();
  await mobilePage.getByText('Mai pubblicata').waitFor();
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'mobile layout should not scroll horizontally');
  const mobileAvailabilityLayout = await mobilePage.locator('.availability-panel').evaluate(node => {
    const state = node.querySelector('.availability-state').getBoundingClientRect();
    const details = node.querySelector('.availability-details').getBoundingClientRect();
    return {
      panelColumns: getComputedStyle(node).gridTemplateColumns,
      detailColumns: getComputedStyle(node.querySelector('.availability-details')).gridTemplateColumns,
      stateBottom: state.bottom,
      detailsTop: details.top
    };
  });
  assert.equal(mobileAvailabilityLayout.panelColumns.split(' ').length, 1, 'student availability state and details should stack on mobile');
  assert.equal(mobileAvailabilityLayout.detailColumns.split(' ').length, 1, 'availability metadata should use one column on mobile');
  assert.ok(mobileAvailabilityLayout.detailsTop >= mobileAvailabilityLayout.stateBottom, 'availability details should follow the status panel on mobile');
  assert.equal(await mobilePage.locator('.context-current').isVisible(), true);
  assert.match(await mobilePage.locator('.preparation-sticky-context').innerText(), /3A Informatica.*Basi di Dati.*Chiavi relazionali/);
  await mobilePage.locator('#preparation-review').scrollIntoViewIfNeeded();
  assert.equal(await mobilePage.locator('.preparation-sticky-context').isVisible(), true, 'class, subject and lesson remain visible while reviewing on mobile');
  const stickyAlignment = await mobilePage.evaluate(() => ({
    headerBottom: document.querySelector('.app-header').getBoundingClientRect().bottom,
    flowTop: document.querySelector('.preparation-flow-nav').getBoundingClientRect().top
  }));
  assert.ok(Math.abs(stickyAlignment.flowTop - stickyAlignment.headerBottom) <= 1, 'preparation navigation remains directly below the sticky application header');
  const mobileReviewLayout = await mobilePage.evaluate(() => {
    const nav = document.querySelector('.artifact-tabs').getBoundingClientRect();
    const pane = document.querySelector('.workspace-pane').getBoundingClientRect();
    return { navBottom: nav.bottom, paneTop: pane.top };
  });
  assert.ok(mobileReviewLayout.paneTop >= mobileReviewLayout.navBottom - 1, 'mobile review workspace should stack below the version list');
  if (screenshotsDir) {
    await mobilePage.screenshot({ path: path.join(screenshotsDir, 'after-preparation-mobile-sticky-context-390.png') });
    await mobilePage.evaluate(() => window.scrollTo(0, 0));
    await mobilePage.waitForFunction(() => window.scrollY === 0);
    await mobilePage.waitForTimeout(150);
    await mobilePage.screenshot({ path: path.join(screenshotsDir, 'after-preparation-mobile-390.png'), fullPage: true });
  }
  await mobilePage.getByRole('link', { name: /Disponibilità/ }).tap();
  assert.equal(new URL(mobilePage.url()).hash, '#preparation-availability');

  await teacherPage.setViewportSize({ width: 1440, height: 1000 });
  await teacherPage.evaluate(() => window.scrollTo(0, 0));
  await teacherPage.getByRole('button', { name: 'Conferma pacchetto' }).click();
  const confirmDialog = teacherPage.getByRole('heading', { name: 'Conferma le versioni del pacchetto' });
  await confirmDialog.waitFor();
  const confirmationDialog = teacherPage.locator('.modal-content');
  assert.match(await confirmationDialog.innerText(), /Piano di lezione\s+v2/);
  assert.match(await confirmationDialog.innerText(), /non pubblica i materiali/);
  await teacherPage.getByRole('button', { name: 'Conferma pacchetto' }).last().click();
  await confirmDialog.waitFor({ state: 'hidden' });
  await teacherPage.locator('.artifact-version-state.confirmed').filter({ hasText: 'Inclusa nell’ultima conferma del pacchetto' }).waitFor();
  await teacherPage.getByText('Mai pubblicata').waitFor();
  await teacherPage.getByRole('button', { name: /Pubblica v1 agli studenti/ }).waitFor();
  assert.equal(service.getLessonPack(lessonA.id).confirmation.artifactVersions.lessonPlan.version, 2);
  assert.equal(dbManager.prepare('SELECT COUNT(*) AS count FROM material_publication_events').get().count, 0);
  assert.equal(observedWrites.some(request => /publish|unpublish/i.test(request)), false);
  if (screenshotsDir) {
    await teacherPage.evaluate(() => window.scrollTo(0, 0));
    await teacherPage.screenshot({ path: path.join(screenshotsDir, 'after-preparation-confirmed-desktop-1440.png'), fullPage: true });
  }
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(serverErrors, []);

});
