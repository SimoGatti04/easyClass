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

test('C5 teacher dashboard end-to-end: author, monitor, operate, correct, confirm and export', async (t) => {
  const runRoot = path.resolve(process.cwd(), '.tmp', 'dev-preview', `c5-browser-${process.pid}-${Date.now()}`);
  fs.mkdirSync(runRoot, { recursive: true });
  const dbManager = new DatabaseManager(path.join(runRoot, 'teacher-c5-e2e.sqlite')).init();
  const fileStore = new FileStore(path.join(runRoot, 'filestore'));
  const service = new TeacherService({ dbManager, fileStore, mockAi: true, classPinSecret: 'synthetic-c5-browser-class-pin-secret-2026' });

  const classroom = service.createClass({ name: '5A Informatica C5 E2E', academicYear: '2026/2027' });
  const subject = service.createSubject({ classId: classroom.id, name: 'Basi di Dati' });
  const student1 = service.addStudent({ classId: classroom.id, firstName: 'Ada', lastName: 'Rossi' });
  const student2 = service.addStudent({ classId: classroom.id, firstName: 'Alan', lastName: 'Verdi' });
  const handout = service.createMaterial({
    title: 'Materiale sintetico C5',
    contentText: 'Una chiave primaria identifica in modo univoco ogni riga; una chiave esterna collega record tra tabelle.',
    pedagogicalRole: 'student_material',
    classId: classroom.id,
    subjectId: subject.id
  });
  service.publishMaterial(handout.id, { versionNumber: 1 });

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const keyId = `c5-browser-${process.pid}`;
  setTestAuthKeys({ keys: new Map([[keyId, crypto.createPublicKey(publicKey)]]) });
  const webAud = 'teacher-service-c5-browser-aud';
  const teacherEmail = 'teacher-c5-e2e@example.test';
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
  let teacherContext;
  let mobileStudentContext;
  let tabletStudentContext;
  const pageErrors = [];
  const serverErrors = [];
  let assessment;
  let extraTimeRequest;
  let withdrawalRequest;

  t.after(async () => {
    for (const context of [teacherContext, mobileStudentContext, tabletStudentContext]) {
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
      t.skip('Sandbox policy denied loopback bind; run this browser E2E on the host to verify HTTP.');
      return;
    }
    throw error;
  }
  const { url } = started;
  browser = await chromium.launch({ headless: true });
  teacherContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await teacherContext.addCookies([{ name: 'CF_Authorization', value: teacherJwt, url }]);
  const teacherPage = await teacherContext.newPage();
  teacherPage.on('pageerror', error => pageErrors.push(`teacher: ${error.message}`));
  teacherPage.on('response', response => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });
  teacherPage.on('request', request => {
    if (request.url().includes('/extra-time') && request.method() === 'POST') extraTimeRequest = request.postDataJSON();
    if (request.url().endsWith('/withdraw') && request.method() === 'POST') withdrawalRequest = request.postDataJSON();
  });

  // Confirm that the teacher API stays protected when a public student browser has no teacher cookie.
  mobileStudentContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const unauthenticatedTeacherApi = await mobileStudentContext.request.get(`${url}/api/classes`);
  assert.equal(unauthenticatedTeacherApi.status(), 401, 'teacher REST endpoints reject unauthenticated principals');

  // Teacher creates the assessment and its questions through the actual React dashboard.
  await teacherPage.goto(`${url}/docente`);
  await teacherPage.getByRole('heading', { name: 'Panoramica verifiche' }).waitFor();
  await teacherPage.getByRole('button', { name: /Attività/ }).click();
  await teacherPage.getByRole('button', { name: /Nuova Attività \/ Verifica/ }).click();
  await teacherPage.getByPlaceholder('Es: Verifica su Basi di Dati e SQL').fill('C5 — Chiavi e relazioni');
  await teacherPage.getByRole('button', { name: /Crea Attività/ }).click();
  const assessmentRow = teacherPage.getByRole('row').filter({ hasText: 'C5 — Chiavi e relazioni' });
  await assessmentRow.waitFor();
  assessment = service.listAssessments({ classId: classroom.id }).find(item => item.title === 'C5 — Chiavi e relazioni');
  assert.ok(assessment, 'the assessment created in the UI is persisted in the isolated SQLite database');

  await assessmentRow.getByRole('button', { name: /Quesiti/ }).click();
  const itemForm = teacherPage.locator('.item-form-section');
  await itemForm.locator('select.form-select').first().selectOption('open_question');
  await itemForm.locator('input[type="number"]').fill('5');
  await itemForm.getByPlaceholder('Inserisci la traccia del quesito...').fill('Spiega a cosa serve una chiave primaria.');
  let addItemResponse = teacherPage.waitForResponse(response => response.url().endsWith(`/api/assessments/${assessment.id}/items`) && response.status() === 201);
  await itemForm.getByRole('button', { name: 'Aggiungi Quesito' }).click();
  assert.equal((await addItemResponse).status(), 201);

  await itemForm.locator('select.form-select').first().selectOption('open_question');
  await itemForm.locator('input[type="number"]').fill('5');
  await itemForm.getByPlaceholder('Inserisci la traccia del quesito...').fill('Spiega come una chiave esterna collega due tabelle.');
  addItemResponse = teacherPage.waitForResponse(response => response.url().endsWith(`/api/assessments/${assessment.id}/items`) && response.status() === 201);
  await itemForm.getByRole('button', { name: 'Aggiungi Quesito' }).click();
  assert.equal((await addItemResponse).status(), 201);
  await teacherPage.locator('.modal-overlay').last().getByRole('button', { name: 'Chiudi' }).click();

  await assessmentRow.getByRole('combobox').selectOption('ready');
  await teacherPage.waitForResponse(response => response.url().endsWith(`/api/assessments/${assessment.id}/status`) && response.request().method() === 'PUT' && response.status() === 200);
  await assessmentRow.getByRole('combobox').selectOption('active');
  await teacherPage.waitForResponse(response => response.url().endsWith(`/api/assessments/${assessment.id}/status`) && response.request().method() === 'PUT' && response.status() === 200);
  assert.equal(await assessmentRow.getByRole('combobox').inputValue(), 'active', 'the teacher dashboard reflects the active lifecycle state');

  // Teacher creates one shared class PIN in the roster UI. It is not tied to a student's identity.
  await teacherPage.getByRole('button', { name: 'Registro studenti' }).click();
  const classSelector = teacherPage.locator('.select-class-dropdown');
  await classSelector.selectOption(classroom.id);
  const pinManager = teacherPage.locator('.class-pin-manager');
  await pinManager.getByRole('heading', { name: 'Accesso alle Attività' }).waitFor();
  const generatePinResponse = teacherPage.waitForResponse(response =>
    response.url().endsWith(`/api/classes/${classroom.id}/activity-pin`) && response.request().method() === 'POST' && response.status() === 201
  );
  await pinManager.getByRole('button', { name: 'Genera PIN' }).click();
  await generatePinResponse;
  const classPin = (await pinManager.locator('.class-pin-value').innerText()).trim();
  assert.match(classPin, /^\d{4}$/, 'teacher dashboard reveals exactly one four-digit class PIN');

  await teacherPage.getByRole('button', { name: 'Attività' }).click();
  await assessmentRow.getByRole('button', { name: /Monitora Live/ }).click();
  await teacherPage.getByRole('heading', { name: 'Monitoraggio della classe' }).waitFor();
  await teacherPage.locator('.monitor-student-card').first().waitFor();

  // Two independent students use the real C4 student experience on mobile and tablet.
  tabletStudentContext = await browser.newContext({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true });
  const student1Page = await mobileStudentContext.newPage();
  const student2Page = await tabletStudentContext.newPage();
  student1Page.on('pageerror', error => pageErrors.push(`student mobile: ${error.message}`));
  student2Page.on('pageerror', error => pageErrors.push(`student tablet: ${error.message}`));
  for (const [page, studentId, desk] of [
    [student1Page, student1.id, 'Fila 1'],
    [student2Page, student2.id, 'Fila 2']
  ]) {
    await page.goto(`${url}/studente`);
    await page.locator('.public-class-card').filter({ hasText: classroom.name }).click();
    await page.getByRole('button', { name: /Accedi alle attività/ }).click();
    await page.getByLabel('PIN della classe').fill(classPin);
    await page.getByRole('button', { name: 'Continua' }).click();
    await page.getByRole('button', { name: new RegExp('C5 — Chiavi e relazioni') }).click();
    await page.getByLabel('Il tuo nominativo').selectOption(studentId);
    await page.getByPlaceholder('Es. Fila 2').fill(desk);
    await page.getByLabel('Vicino a sinistra').selectOption('none');
    await page.getByLabel('Vicino a destra').selectOption('none');
    await page.getByRole('button', { name: 'Inizia attività' }).click();
    await page.locator('.student-question-card').waitFor();
  }

  // Refresh once so teacher actions use the newly persisted student sessions, not the initial roster snapshot.
  await teacherPage.getByRole('button', { name: 'Aggiorna ora' }).click();
  const student1Card = teacherPage.locator(`.monitor-student-card[data-student-id="${student1.id}"]`);
  await student1Card.getByText('In corso').waitFor();

  // Exercise the confirmed +5-minute quick action as well as the configurable amount below.
  const student2Card = teacherPage.locator(`.monitor-student-card[data-student-id="${student2.id}"]`);
  await student2Card.getByRole('button', { name: 'Dettagli e azioni' }).click();
  const student2Detail = teacherPage.getByRole('dialog', { name: /Dettaglio tentativo/ });
  await student2Detail.getByRole('button', { name: 'Concedi +5 min (rapido)' }).click();
  await student2Detail.getByRole('button', { name: 'Conferma operazione' }).click();
  await student2Detail.getByRole('status').filter({ hasText: /Aggiunti 5 minuti/ }).waitFor();
  const student2SubmissionId = service.getStudentSubmission(assessment.id, student2.id, { role: 'teacher' }).id;
  let student2Submission = service.getSubmission(student2SubmissionId);
  assert.equal(student2Submission.extra_time_minutes, 5);
  assert.equal(student2Submission.actionEvents.find(event => event.action === 'extra_time')?.reason, 'Concessione rapida di 5 minuti da parte del docente');
  await student2Detail.getByLabel('Chiudi dettagli').click();

  // Grant a configurable amount from the monitor. Replaying its request must not double-add time.
  await student1Card.getByRole('button', { name: 'Dettagli e azioni' }).click();
  const student1Detail = teacherPage.getByRole('dialog', { name: /Dettaglio tentativo/ });
  await student1Detail.locator('.c5-teacher-actions textarea').fill('Interruzione tecnica riferita dalla studentessa');
  await student1Detail.locator('.c5-teacher-actions input[type="number"]').fill('7');
  await student1Detail.getByRole('button', { name: 'Concedi tempo extra' }).click();
  await student1Detail.getByRole('button', { name: 'Conferma operazione' }).click();
  await student1Detail.getByRole('status').filter({ hasText: /Aggiunti 7 minuti/ }).waitFor();
  assert.ok(extraTimeRequest?.idempotencyKey, 'the UI sends a stable idempotency key with extra time');
  const duplicateExtra = await teacherContext.request.post(`${url}/api/assessments/${assessment.id}/submissions/${student1.id}/extra-time`, { data: extraTimeRequest, headers: { cookie: `CF_Authorization=${teacherJwt}`, origin: url } });
  assert.equal(duplicateExtra.status(), 200, await duplicateExtra.text());
  const student1SubmissionId = service.getStudentSubmission(assessment.id, student1.id, { role: 'teacher' }).id;
  let student1Submission = service.getSubmission(student1SubmissionId);
  assert.equal(student1Submission.extra_time_minutes, 7, 'duplicate extra-time delivery does not add minutes twice');
  assert.equal(student1Submission.actionEvents.filter(event => event.action === 'extra_time').length, 1);
  await student1Detail.getByRole('button', { name: 'Chiudi dettagli' }).last().click();

  // Persist both answers for Ada, only one for Alan, then submit Ada from the student UI.
  await student1Page.locator('.student-question-card').first().locator('textarea').fill('La chiave primaria identifica ogni riga in modo univoco.');
  await student1Page.getByRole('status').filter({ hasText: /Salvato \(Rev/ }).waitFor();
  await student1Page.locator('.question-dot').nth(1).click();
  await student1Page.locator('.student-question-card').first().locator('textarea').fill('La chiave esterna contiene un riferimento alla chiave primaria di un’altra tabella.');
  await student1Page.getByRole('status').filter({ hasText: /Salvato \(Rev/ }).waitFor();
  await student2Page.locator('.student-question-card').first().locator('textarea').fill('La chiave primaria distingue univocamente ogni record.');
  await student2Page.getByRole('status').filter({ hasText: /Salvato \(Rev/ }).waitFor();
  await student1Page.getByRole('button', { name: /Consegna Definitiva Prova/ }).click();
  await student1Page.getByRole('button', { name: /Conferma e Consegna/ }).click();
  await student1Page.getByRole('heading', { name: /Prova Consegnata con Successo/ }).waitFor();

  // Refresh from the UI, announce the new submission once, then withdraw Alan without discarding the server-saved answer.
  await teacherPage.getByRole('button', { name: 'Aggiorna ora' }).click();
  const announcement = teacherPage.getByRole('region', { name: 'Nuove consegne' });
  await announcement.getByText('Rossi Ada').waitFor();
  await teacherPage.getByRole('button', { name: 'Aggiorna ora' }).click();
  assert.equal(await announcement.locator('.c5-announcement-row').count(), 1, 'repeated polling does not repeat a submission announcement');

  await student2Card.getByRole('button', { name: 'Dettagli e azioni' }).click();
  await student2Detail.locator('.c5-teacher-actions textarea').fill('La prova viene terminata per una necessità organizzativa');
  await student2Detail.getByRole('button', { name: 'Ritira tentativo e conserva risposte' }).click();
  await student2Detail.getByRole('button', { name: 'Conferma operazione' }).click();
  await student2Detail.getByRole('status').filter({ hasText: /risposte già salvate sono state conservate/ }).waitFor();
  assert.ok(withdrawalRequest?.idempotencyKey, 'the UI sends a stable idempotency key with teacher withdrawal');
  const duplicateWithdrawal = await teacherContext.request.post(`${url}/api/submissions/${service.getStudentSubmission(assessment.id, student2.id, { role: 'teacher' }).id}/withdraw`, { data: withdrawalRequest, headers: { cookie: `CF_Authorization=${teacherJwt}`, origin: url } });
  assert.equal(duplicateWithdrawal.status(), 200, await duplicateWithdrawal.text());
  student2Submission = service.getSubmission(student2SubmissionId);
  assert.equal(student2Submission.attempt_status, 'teacher_withdrawn');
  assert.equal(student2Submission.responses.length, 1, 'teacher withdrawal preserves the student response already saved');
  assert.equal(student2Submission.actionEvents.filter(event => event.action === 'teacher_withdrawal').length, 1, 'duplicate withdrawal is idempotent');

  // Reopening is available only with a reason and is auditable; end by withdrawing again to preserve the C5 monitoring scenario.
  await student2Detail.getByRole('button', { name: 'Chiudi dettagli' }).last().click();
  await teacherPage.locator(`.monitor-student-card[data-student-id="${student2.id}"]`).getByRole('button', { name: 'Dettagli e azioni' }).click();
  await student2Detail.locator('.c5-teacher-actions textarea').fill('Riapertura di controllo per verifica del flusso');
  await student2Detail.getByRole('button', { name: 'Richiedi riapertura' }).click();
  await student2Detail.getByRole('button', { name: 'Conferma operazione' }).click();
  await student2Detail.getByRole('status').filter({ hasText: /tentativo riaperto/i }).waitFor();
  await student2Detail.locator('.c5-teacher-actions textarea').fill('Ritiro finale al termine della prova di controllo');
  await student2Detail.getByRole('button', { name: 'Ritira tentativo e conserva risposte' }).click();
  await student2Detail.getByRole('button', { name: 'Conferma operazione' }).click();
  await student2Detail.getByRole('status').filter({ hasText: /risposte già salvate sono state conservate/ }).waitFor();
  student2Submission = service.getSubmission(student2SubmissionId);
  assert.equal(student2Submission.responses.length, 1);
  assert.equal(student2Submission.actionEvents.filter(event => event.action === 'reopen').length, 1);
  assert.equal(student2Submission.actionEvents.filter(event => event.action === 'teacher_withdrawal').length, 2);

  // Navigate from the live roster into a persisted submission and explicitly request a synthetic mock AI proposal.
  await student2Detail.getByRole('button', { name: 'Chiudi dettagli' }).last().click();
  await teacherPage.locator(`.monitor-student-card[data-student-id="${student1.id}"]`).getByRole('button', { name: 'Apri consegna' }).click();
  const correctionDialog = teacherPage.getByRole('dialog', { name: /Correzione/ });
  await correctionDialog.getByText('La chiave primaria identifica ogni riga in modo univoco.').waitFor();
  await correctionDialog.getByText('Consegna salvata sul server').waitFor();
  await correctionDialog.getByLabel(/Confermo di essere autorizzato/).check();
  await correctionDialog.getByRole('button', { name: 'Genera proposta deterministica e AI' }).click();
  await teacherPage.getByText('Proposta di correzione generata. Non modifica né conferma il voto del docente.').waitFor();
  await correctionDialog.getByText('Proposta AI').first().waitFor();
  assert.equal(service.getSubmission(student1Submission.id).final_grade, null, 'proposal generation does not finalize the grade');
  await correctionDialog.getByRole('button', { name: 'Chiudi correzione' }).click();

  // Question-centric review persists item scores for both the submitted and teacher-withdrawn attempts.
  await teacherPage.getByRole('button', { name: 'Per quesito' }).click();
  const questionCards = teacherPage.locator('.question-response-card');
  await questionCards.first().waitFor();
  assert.equal(await questionCards.count(), 2, 'question review shows both students in the class');
  const adaQuestionCard = questionCards.filter({ hasText: 'Ada Rossi' });
  const alanQuestionCard = questionCards.filter({ hasText: 'Alan Verdi' });
  await adaQuestionCard.locator('input[type="number"]').fill('5');
  await adaQuestionCard.locator('textarea').first().fill('Definizione corretta.');
  await adaQuestionCard.getByRole('button', { name: 'Salva correzione del quesito' }).click();
  await teacherPage.getByText(/Correzione manuale salvata/).waitFor();
  await alanQuestionCard.locator('input[type="number"]').fill('4');
  await alanQuestionCard.locator('textarea').first().fill('Risposta corretta, con un piccolo margine di precisione.');
  await alanQuestionCard.getByRole('button', { name: 'Salva correzione del quesito' }).click();
  await teacherPage.getByText(/Correzione manuale salvata/).waitFor();

  // Correct the second item, including an explicit zero for the unanswered response.
  await teacherPage.locator('.question-review-toolbar select').selectOption({ index: 1 });
  await teacherPage.locator('.question-response-card').first().waitFor();
  const adaQ2 = teacherPage.locator('.question-response-card').filter({ hasText: 'Ada Rossi' });
  const alanQ2 = teacherPage.locator('.question-response-card').filter({ hasText: 'Alan Verdi' });
  await adaQ2.locator('input[type="number"]').fill('5');
  await adaQ2.locator('textarea').first().fill('Collegamento descritto correttamente.');
  await adaQ2.getByRole('button', { name: 'Salva correzione del quesito' }).click();
  await teacherPage.getByText(/Correzione manuale salvata/).waitFor();
  await alanQ2.locator('input[type="number"]').fill('0');
  await alanQ2.locator('textarea').first().fill('Nessuna risposta salvata per il secondo quesito.');
  await alanQ2.getByRole('button', { name: 'Salva correzione del quesito' }).click();
  await teacherPage.getByText(/Correzione manuale salvata/).waitFor();

  // Confirm each final grade from the student-centric view; the confirmed score is now counted in statistics.
  await teacherPage.getByRole('button', { name: 'Per studente' }).click();
  for (const [studentName, grade] of [['Ada Rossi', '10/10'], ['Alan Verdi', '4/10']]) {
    const submissionCard = teacherPage.locator('.submission-summary-card').filter({ hasText: studentName });
    await submissionCard.getByRole('button', { name: 'Esamina e correggi' }).click();
    const dialog = teacherPage.getByRole('dialog', { name: /Correzione/ });
    await dialog.getByPlaceholder('Es. 8, 8/10, Buono').fill(grade);
    await dialog.getByRole('button', { name: 'Conferma voto definitivo' }).click();
    await teacherPage.getByText('Voto definitivo confermato e registrato.').waitFor();
    await dialog.getByRole('button', { name: 'Chiudi correzione' }).click();
  }

  const stats = service.getAssessmentStatistics(assessment.id);
  assert.equal(stats.gradingCompletedCount, 2);
  assert.equal(stats.finalGradeDenominator, 2, 'only explicitly confirmed grades are in the average denominator');
  assert.equal(stats.meanFinalScore, 7);
  assert.equal(stats.populationStdDevFinalScore, 3, 'population standard deviation uses only the two confirmed scores (10 and 4)');
  assert.equal(stats.populationStdDevFinalPercent, 10, 'percent normalization uses the assessment maximum score of 30');
  await teacherPage.getByText('Denominatore media').waitFor();
  assert.equal(await teacherPage.locator('.assessment-statistic').filter({ hasText: 'Denominatore media' }).locator('strong').innerText(), '2');
  assert.equal(await teacherPage.locator('.assessment-statistic').filter({ hasText: 'Deviazione standard punti' }).locator('strong').innerText(), '3');

  const csvDownload = teacherPage.waitForEvent('download');
  await teacherPage.getByRole('link', { name: 'Esporta CSV' }).click();
  const download = await csvDownload;
  const downloadedPath = await download.path();
  const exported = fs.readFileSync(downloadedPath, 'utf8');
  assert.match(exported, /Ada/);
  assert.match(exported, /Alan/);
  assert.match(exported, /10\/10/);
  assert.match(exported, /4\/10/);

  // Actual browser layouts are exercised at desktop, tablet and phone sizes.
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await teacherPage.setViewportSize(viewport);
    const dimensions = await teacherPage.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    assert.ok(dimensions.content <= dimensions.viewport + 1, `no horizontal overflow at ${viewport.width}px (${dimensions.content}px content)`);
  }
  for (const page of [student1Page, student2Page]) {
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    assert.ok(dimensions.content <= dimensions.viewport + 1, `student experience fits its viewport (${dimensions.content}px / ${dimensions.viewport}px)`);
  }
  assert.deepEqual(pageErrors, [], `no uncaught browser exceptions: ${pageErrors.join('; ')}`);
  assert.deepEqual(serverErrors, [], `no server errors in browser flow: ${serverErrors.join('; ')}`);
});
