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

const AUDIENCE = 'teacher-service-c6-browser-audience';
const ISSUER = 'https://simogatti.cloudflareaccess.com';

function signAssertion(privateKey, email) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'teacher-service-c6-browser-key', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: `subject:${email}`, email, aud: AUDIENCE, iss: ISSUER, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(privateKey, 'base64url')}`;
}

test('C6 integrity dashboard renders real teacher-only evidence and works on a phone viewport', async (t) => {
  const runRoot = path.resolve(process.cwd(), '.tmp', 'dev-preview', `c6-browser-${process.pid}-${Date.now()}`);
  fs.mkdirSync(runRoot, { recursive: true, mode: 0o700 });
  const dbManager = new DatabaseManager(path.join(runRoot, 'teacher-c6-e2e.sqlite')).init();
  const fileStore = new FileStore(path.join(runRoot, 'filestore'));
  const service = new TeacherService({ dbManager, fileStore, mockAi: true, enableIntegrityAnalysis: true });
  const classroom = service.createClass({ name: '4A Sintetica C6', academicYear: '2026/2027' });
  const subject = service.createSubject({ classId: classroom.id, name: 'Informatica C6' });
  const lesson = service.createLesson({ classId: classroom.id, subjectId: subject.id, title: 'Reti sintetiche', orderIndex: 1 });
  const source = service.createMaterial({
    title: 'Dispensa C6 browser', contentText: 'Il processo di rete instrada i pacchetti tra nodi seguendo la tabella di destinazione.',
    pedagogicalRole: 'student_material', classId: classroom.id, subjectId: subject.id, lessonId: lesson.id
  });
  service.publishMaterial(source.id, { versionNumber: 1 });
  const assessment = service.createAssessment({
    title: 'Verifica C6 browser', classId: classroom.id, subjectId: subject.id, lessonId: lesson.id,
    items: [{
      type: 'open_extended', questionText: 'Descrivi l’anomalia nel passaggio di rete.', maxScore: 10,
      assessableSourceId: source.id, assessableSourceVersion: 1, teacherSolution: 'Soluzione riservata al docente.'
    }]
  });
  const item = assessment.items[0];
  const answerA = 'Il router inoltra il pacchetto; l’indice viola la barriera gialla durante il controllo del registro circolare e lascia un residuo nel buffer temporaneo.';
  const answerB = 'La procedura verifica il buffer: l’indice viola la barriera gialla prima di aggiornare il registro circolare e trasferire il residuo verso il nodo finale.';
  service.importSubmission({ assessmentId: assessment.id, studentId: 'c6-browser-a', studentName: 'Ada Demo', responses: [{ itemId: item.id, responseText: answerA }] });
  service.importSubmission({ assessmentId: assessment.id, studentId: 'c6-browser-b', studentName: 'Luca Demo', responses: [{ itemId: item.id, responseText: answerB }] });

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  setTestAuthKeys({ publicKey, kid: 'teacher-service-c6-browser-key' });
  clearJwksCache();
  const app = await createHttpApp({
    service, authMode: 'strict', teacherEmails: 'c6-browser-teacher@school.example',
    authConfig: { expectedAud: AUDIENCE }
  });
  let browser;
  t.after(async () => {
    try {
      if (browser) await browser.close();
      await app.close();
    } finally {
      dbManager.close();
      setTestAuthKeys(null);
      clearJwksCache();
      if (fs.existsSync(runRoot)) fs.rmSync(runRoot, { recursive: true, force: true });
    }
  });

  let started;
  try { started = await app.start(0, '127.0.0.1'); }
  catch (error) {
    if (error?.code === 'EPERM') {
      t.skip('Sandbox policy denied loopback bind; run this browser E2E on the host to verify HTTP and the actual React dashboard.');
      return;
    }
    throw error;
  }

  browser = await chromium.launch({ headless: true });
  const url = `http://127.0.0.1:${app.server.address().port}`;
  const anonymousContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  assert.equal((await anonymousContext.request.get(`${url}/api/assessments/${assessment.id}/integrity-preview`)).status(), 401,
    'integrity details remain unavailable to an anonymous student browser');
  await anonymousContext.close();

  const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await teacherContext.addCookies([{ name: 'CF_Authorization', value: signAssertion(privateKey, 'c6-browser-teacher@school.example'), url }]);
  const page = await teacherContext.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${url}/#/docente`);
  await page.getByRole('button', { name: /Integrità ed evidenze/ }).click();
  await page.getByRole('heading', { name: 'Integrità ed evidenze' }).waitFor();
  await page.locator('#integrity-assessment').selectOption(assessment.id);
  const evidenceCard = page.locator('.integrity-evidence-card').first();
  await evidenceCard.waitFor();
  await evidenceCard.getByText(/barriera/i).first().waitFor();
  await evidenceCard.getByLabel('Stato della revisione').selectOption('reviewed_no_action');
  await evidenceCard.getByLabel('Nota docente · facoltativa').fill('Revisione browser sintetica.');
  await evidenceCard.getByRole('button', { name: 'Registra revisione' }).click();
  await page.getByRole('status').filter({ hasText: 'Revisione salvata nello storico' }).waitFor();
  await evidenceCard.getByText(/Storico revisioni \(1\)/).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(100);
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(horizontalOverflow, false, 'integrity page must fit the smartphone viewport without horizontal page overflow');
  assert.deepEqual(pageErrors, [], 'React dashboard must not produce browser runtime errors');
  await teacherContext.close();
});
