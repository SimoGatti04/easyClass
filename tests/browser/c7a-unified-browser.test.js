import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createHttpApp } from '../../src/server/http.js';
import { setTestAuthKeys, clearJwksCache } from '../../src/server/auth.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';

const AUDIENCE = 'teacher-service-c7a-unified-web';
const ISSUER = 'https://simogatti.cloudflareaccess.com';
const TEACHER_EMAIL = 'c7a-unified-teacher@example.test';
const SHARED_ANSWER = 'Il router inoltra il pacchetto; l’indice viola la barriera gialla durante il controllo del registro circolare e lascia un residuo nel buffer temporaneo.';

function signedTeacherAssertion(privateKey, kid) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: ISSUER,
    aud: AUDIENCE,
    sub: `synthetic:${TEACHER_EMAIL}`,
    email: TEACHER_EMAIL,
    nbf: now - 10,
    iat: now,
    exp: now + 3600
  })).toString('base64url');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(privateKey, 'base64url')}`;
}

test('C7A unified same-assessment flow: teacher API, two real browser sessions, SQLite/FileStore, grading, exports, MCP and integrity review', async (t) => {
  const runRoot = path.resolve(process.cwd(), '.tmp', 'dev-preview', `c7a-unified-${process.pid}-${Date.now()}`);
  fs.mkdirSync(runRoot, { recursive: true, mode: 0o700 });
  const dbPath = path.join(runRoot, 'teacher.sqlite');
  const filesPath = path.join(runRoot, 'files');
  const dbManager = new DatabaseManager(dbPath).init();
  const fileStore = new FileStore(filesPath);
  const aiRequests = [];
  const aiMock = {
    mockOffline: true,
    async complete({ messages }) {
      aiRequests.push(messages);
      return {
        content: JSON.stringify({ score: 7, confidence: 0.8, reasoning: 'Synthetic mock-only proposal.', criteriaScores: [], feedback: 'Proposta di test, da confermare dal docente.' }),
        model: 'synthetic/mock', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      };
    }
  };
  const service = new TeacherService({ dbManager, fileStore, omniRouteClient: aiMock, mockAi: true, allowExternalStudentGrading: false, enableIntegrityAnalysis: true });
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = `c7a-unified-${process.pid}`;
  setTestAuthKeys({ keys: new Map([[kid, publicKey]]) });
  clearJwksCache();
  const teacherJwt = signedTeacherAssertion(privateKey, kid);
  const app = await createHttpApp({
    service,
    teacherEmails: TEACHER_EMAIL,
    authConfig: { webAud: AUDIENCE, mcpAud: AUDIENCE, expectedIss: ISSUER, allowSyntheticAuth: false }
  });
  let browser;
  let student1Context;
  let student2Context;
  let mcpSessionId;
  t.after(async () => {
    try { await student1Context?.close(); } catch {}
    try { await student2Context?.close(); } catch {}
    try { await browser?.close(); } catch {}
    try { await app.close(); } catch {}
    try { service.close(); } catch {}
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
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  const teacherApi = async (route, { method = 'GET', body } = {}) => {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        'Cf-Access-Jwt-Assertion': teacherJwt,
        ...(method === 'GET' ? {} : { Origin: baseUrl }),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Teacher API ${method} ${route} failed: HTTP ${response.status} ${text.slice(0, 200)}`);
    const type = response.headers.get('content-type') || '';
    return type.includes('application/json') ? JSON.parse(text) : text;
  };

  // The same assessment and source are created via the teacher REST surface.
  const { class: classroom } = await teacherApi('/api/classes', { method: 'POST', body: { name: '3A Synthetic C7A', academicYear: '2026/2027' } });
  const { subject } = await teacherApi('/api/subjects', { method: 'POST', body: { classId: classroom.id, name: 'Reti e sistemi' } });
  const { students } = await teacherApi(`/api/classes/${classroom.id}/students`, {
    method: 'POST', body: { students: [{ firstName: 'Ada', lastName: 'Fixture' }, { firstName: 'Alan', lastName: 'Fixture' }] }
  });
  assert.equal(students.length, 2);
  const source = service.createMaterial({
    title: 'Scheda pubblicata C7A fixture',
    contentText: 'Un router inoltra i pacchetti tra reti. La tabella di instradamento associa destinazioni a percorsi e interfacce.',
    pedagogicalRole: 'student_material',
    classId: classroom.id,
    subjectId: subject.id
  });
  service.publishMaterial(source.id, { versionNumber: 1 });

  const { assessment: created } = await teacherApi('/api/assessments', {
    method: 'POST',
    body: { title: 'Prova C7A unica', description: 'Fixture sintetica end-to-end.', classId: classroom.id, subjectId: subject.id, durationMinutes: 60, maxScore: 40 }
  });
  const itemSpecs = [
    { type: 'multiple_choice', questionText: 'Quale dispositivo inoltra pacchetti tra reti?', maxScore: 10, options: [{ id: 'A', text: 'Router', isCorrect: true }, { id: 'B', text: 'Stampante', isCorrect: false }], isSelfCorrecting: true, teacherSolution: 'Router.' },
    { type: 'open_extended', questionText: 'Descrivi una situazione sintetica di instradamento.', maxScore: 10, teacherSolution: 'Risposta argomentata sul router.' },
    { type: 'code', questionText: 'Scrivi una breve funzione di inoltro simulato.', maxScore: 10, language: 'python', starterCode: 'def forward(packet):\n    ', teacherSolution: 'Una funzione Python chiara e coerente.' },
    { type: 'attachment', questionText: 'Allega un piccolo file di configurazione.', maxScore: 10, teacherSolution: 'File di configurazione valido.' }
  ];
  const items = [];
  for (const [index, spec] of itemSpecs.entries()) {
    const { item } = await teacherApi(`/api/assessments/${created.id}/items`, {
      method: 'POST',
      body: { ...spec, orderIndex: index, assessableSourceId: source.id, assessableSourceVersion: 1, rubricJson: { criteria: [{ name: 'coerenza', maxScore: 10 }] } }
    });
    items.push(item);
  }
  await teacherApi(`/api/assessments/${created.id}/status`, { method: 'PUT', body: { status: 'ready' } });
  await teacherApi(`/api/assessments/${created.id}/status`, { method: 'PUT', body: { status: 'active' } });

  const credentials = service.listActivityCredentials(created.id);
  const credentialFor = (studentId) => credentials.find((entry) => entry.studentId === studentId)?.accessCode;
  const student1Code = credentialFor(students[0].id);
  const student2Code = credentialFor(students[1].id);
  assert.ok(student1Code && student2Code);

  const publicClasses = await fetch(`${baseUrl}/api/student/classes`).then((response) => response.json());
  assert.ok(publicClasses.classes.some((entry) => entry.id === classroom.id));
  const anonymousTeacherApi = await fetch(`${baseUrl}/api/classes`);
  assert.equal(anonymousTeacherApi.status, 401);

  browser = await chromium.launch({ headless: true });
  student1Context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  student2Context = await browser.newContext({ viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true });
  const student1Page = await student1Context.newPage();
  const student2Page = await student2Context.newPage();
  const browserDiagnostics = [];
  for (const [index, page] of [student1Page, student2Page].entries()) {
    page.on('pageerror', (error) => browserDiagnostics.push(`page${index + 1}: ${error.message}`));
    page.on('requestfailed', (request) => browserDiagnostics.push(`request${index + 1}: ${request.url()} ${request.failure()?.errorText || ''}`));
  }
  await Promise.all([
    student1Page.goto(`${url}/studente?code=${encodeURIComponent(student1Code)}`),
    student2Page.goto(`${url}/studente?code=${encodeURIComponent(student2Code)}`)
  ]);
  for (const page of [student1Page, student2Page]) {
    try {
      await page.getByRole('heading', { name: /Dichiarazione Postazione/ }).waitFor({ timeout: 8000 });
    } catch {
      throw new Error(`Student entry did not reach seat declaration. URL=${page.url()} BODY=${(await page.locator('body').innerText()).slice(0, 1200)} DIAGNOSTICS=${browserDiagnostics.join(' | ')}`);
    }
    await page.getByRole('button', { name: /Conferma Postazione e Inizia Prova/ }).click();
    await page.locator('.student-question-card').waitFor();
  }
  const { assessment } = await teacherApi(`/api/assessments/${created.id}`);
  assert.equal(assessment.items.length, 4);
  assert.deepEqual(assessment.items.map((item) => item.type), ['multiple_choice', 'open_extended', 'code', 'attachment']);

  // Teacher monitoring and extra time observe those same active browser attempts.
  const extraTime = await teacherApi(`/api/assessments/${created.id}/submissions/${students[0].id}/extra-time`, {
    method: 'POST', body: { extraMinutes: 5, reason: 'Synthetic accessibility fixture', idempotencyKey: 'c7a-extra-time-001' }
  });
  assert.equal(extraTime.success, true);
  const live = await teacherApi(`/api/assessments/${created.id}/live-monitor`);
  assert.ok(live.liveMonitoring.students.some((entry) => entry.studentId === students[0].id));

  // Simulate a genuine browser network interruption, retain the local draft,
  // reconnect and verify the server-confirmed revision before proceeding.
  await student1Context.setOffline(true);
  await student1Page.getByRole('button', { name: /Vai al quesito 2/ }).click();
  await student1Page.locator('.student-question-card textarea').fill(SHARED_ANSWER);
  await student1Page.getByRole('status').filter({ hasText: /Solo su questo dispositivo/ }).waitFor();
  await student1Context.setOffline(false);
  await student1Page.getByRole('status').filter({ hasText: /Salvato \(Rev \d+\)/ }).waitFor();
  await student1Page.getByRole('button', { name: /Vai al quesito 1/ }).click();
  await student1Page.locator(`input[name="mcq_${items[0].id}"][value="A"]`).check();
  await student1Page.getByRole('button', { name: /Vai al quesito 3/ }).click();
  await student1Page.getByRole('textbox', { name: 'Codice per quesito 3' }).fill('def forward(packet):\n    return packet');
  await student1Page.getByRole('button', { name: /Vai al quesito 4/ }).click();
  await student1Page.locator('.student-question-card input[type="file"]').setInputFiles({
    name: 'synthetic-config.txt', mimeType: 'text/plain', buffer: Buffer.from('route=synthetic\n')
  });
  await student1Page.getByText(/synthetic-config\.txt/).waitFor();
  await student1Page.getByRole('status').filter({ hasText: /Salvato \(Rev \d+\)/ }).waitFor();

  await student2Page.getByRole('button', { name: /Vai al quesito 2/ }).click();
  await student2Page.locator('.student-question-card textarea').fill(SHARED_ANSWER);
  await student2Page.getByRole('button', { name: /Vai al quesito 3/ }).click();
  await student2Page.getByRole('textbox', { name: 'Codice per quesito 3' }).fill('def forward(packet):\n    return packet');
  await student2Page.getByRole('button', { name: /Vai al quesito 1/ }).click();
  await student2Page.locator(`input[name="mcq_${items[0].id}"][value="A"]`).check();
  await student2Page.getByRole('status').filter({ hasText: /Salvato \(Rev \d+\)/ }).waitFor();

  const browserTokens = await Promise.all([student1Page, student2Page].map((page) => page.evaluate(() => sessionStorage.getItem('teacher_service_student_token'))));
  assert.ok(browserTokens.every(Boolean), 'both active browser sessions have individual session tokens');
  for (const page of [student1Page, student2Page]) {
    await page.getByRole('button', { name: /Consegna Definitiva Prova/ }).click();
    await page.getByRole('button', { name: /Conferma e Consegna/ }).click();
    await page.getByText(/Prova Consegnata con Successo!/).waitFor();
  }

  const readOwnBrowserSubmission = async (page, token) => page.evaluate(async ({ assessmentId, token }) => {
    const response = await fetch(`/api/student/activities/${assessmentId}/submission`, { headers: { 'X-Student-Token': token } });
    return { status: response.status, payload: await response.json() };
  }, { assessmentId: created.id, token });
  const own1 = await readOwnBrowserSubmission(student1Page, browserTokens[0]);
  const own2 = await readOwnBrowserSubmission(student2Page, browserTokens[1]);
  assert.equal(own1.status, 200);
  assert.equal(own2.status, 200);
  assert.equal(own1.payload.submission.attempt_status, 'submitted');
  assert.equal(own2.payload.submission.attempt_status, 'submitted');
  assert.ok(own1.payload.submission.responses.some((response) => response.item_id === items[1].id && response.response_text === SHARED_ANSWER));
  const browserAttachment = own1.payload.submission.responses.find((response) => response.item_id === items[3].id);
  assert.ok(browserAttachment?.attachment_id && browserAttachment.has_attachment, 'student receives an opaque attachment reference, not a private FileStore path');
  assert.equal(browserAttachment.attachment_name, 'synthetic-config.txt');

  // Compare exact item and response IDs/content at the DB, REST, browser, and export boundaries.
  const dbAssessment = dbManager.prepare('SELECT id, version, title FROM assessments WHERE id = ?').get(created.id);
  assert.equal(dbAssessment.id, created.id);
  const dbItems = dbManager.prepare('SELECT id, type, question_text, teacher_solution FROM assessment_items WHERE assessment_id = ? ORDER BY order_index').all(created.id);
  assert.deepEqual(dbItems.map(({ id, type, question_text }) => ({ id, type, question_text })), assessment.items.map(({ id, type, question_text }) => ({ id, type, question_text })));
  assert.ok(dbItems.every((item) => item.teacher_solution));
  const teacherSubs = await teacherApi(`/api/assessments/${created.id}/submissions`);
  assert.equal(teacherSubs.submissions.length, 2);
  const dbSubmissions = dbManager.prepare('SELECT id, student_id, attempt_status, assessment_version FROM assessment_submissions WHERE assessment_id = ? ORDER BY student_id').all(created.id).map((row) => ({ ...row }));
  assert.deepEqual(teacherSubs.submissions.map((entry) => ({ id: entry.id, student_id: entry.student_id, attempt_status: entry.attempt_status, assessment_version: entry.assessment_version })).sort((a, b) => a.student_id.localeCompare(b.student_id)), dbSubmissions);
  const dbResponses = dbManager.prepare('SELECT r.submission_id, r.item_id, r.response_text, r.attachment_path FROM submission_responses r JOIN assessment_submissions s ON s.id = r.submission_id WHERE s.assessment_id = ?').all(created.id).map((row) => ({ ...row })).sort((a, b) => a.submission_id.localeCompare(b.submission_id) || a.item_id.localeCompare(b.item_id));
  const browserResponses = [...own1.payload.submission.responses.map((response) => ({ submission_id: own1.payload.submission.id, item_id: response.item_id, response_text: response.response_text })), ...own2.payload.submission.responses.map((response) => ({ submission_id: own2.payload.submission.id, item_id: response.item_id, response_text: response.response_text }))].sort((a, b) => a.submission_id.localeCompare(b.submission_id) || a.item_id.localeCompare(b.item_id));
  assert.deepEqual(browserResponses, dbResponses.map(({ submission_id, item_id, response_text }) => ({ submission_id, item_id, response_text })));
  const storedAttachment = dbResponses.find((response) => response.submission_id === own1.payload.submission.id && response.item_id === items[3].id);
  assert.ok(storedAttachment?.attachment_path);
  assert.match(service.fileStore.readStoredFile(storedAttachment.attachment_path).buffer.toString('utf8'), /route=synthetic/);

  const deterministicStatistics = await teacherApi(`/api/assessments/${created.id}/statistics`);
  assert.equal(deterministicStatistics.statistics.submittedCount, 2);
  const exportJson = await teacherApi(`/api/assessments/${created.id}/export?format=json`);
  assert.equal(exportJson.assessment.id, created.id);
  assert.deepEqual(exportJson.submissions.map((entry) => entry.id).sort(), dbSubmissions.map((entry) => entry.id).sort());
  assert.deepEqual(exportJson.submissions.flatMap((submission) => submission.responses.map((response) => ({ submission_id: submission.id, item_id: response.item_id, response_text: response.response_text, attachment_path: response.attachment_path }))).sort((a, b) => a.submission_id.localeCompare(b.submission_id) || a.item_id.localeCompare(b.item_id)), dbResponses);

  // Mock-only grading produces proposals; the teacher explicitly records the final decision.
  assert.equal(service.assessments.allowExternalStudentGrading, false);
  for (const submission of teacherSubs.submissions) {
    const gradeResponse = await fetch(`${baseUrl}/api/submissions/${submission.id}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: baseUrl, 'Cf-Access-Jwt-Assertion': teacherJwt },
      body: JSON.stringify({ evaluator: 'synthetic-c7a' })
    });
    if (submission.id === own1.payload.submission.id) {
      assert.equal(gradeResponse.status, 400, 'attachment-only response requires explicit teacher review');
      assert.equal(service.getSubmission(submission.id).evaluations.length, 0, 'failed AI grading persists no partial evaluations');
    } else {
      assert.equal(gradeResponse.status, 200, 'the other synthetic response can be graded through the mock adapter');
    }
    const review = await teacherApi(`/api/submissions/${submission.id}/review`, {
      method: 'POST', body: {
        finalGrade: '8.0', reviewer: TEACHER_EMAIL,
        itemOverrides: items.map((item) => ({ itemId: item.id, score: item.max_score, feedback: 'Conferma docente sintetica.' }))
      }
    });
    assert.equal(review.submission.final_grade, '8.0');
  }
  assert.ok(aiRequests.length > 0);
  const confirmed = await teacherApi(`/api/assessments/${created.id}/submissions`);
  assert.ok(confirmed.submissions.every((submission) => submission.final_grade === '8.0'));

  // Inspect and review C6 evidence on the same finalized submissions, without any decision automation.
  const integrity = await teacherApi(`/api/assessments/${created.id}/integrity-preview`);
  const sharedResponseEvidence = integrity.integrityAnalysis.evidence.find((entry) => entry.itemId === items[1].id);
  assert.ok(sharedResponseEvidence, 'the identical synthetic extended responses must produce a reviewable observation');

  // MCP Streamable HTTP: initialize, discover, read, export, analyze, and append a teacher review.
  const postMcp = async (body, sessionId = mcpSessionId) => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'Cf-Access-Jwt-Assertion': teacherJwt,
        ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {})
      },
      body: JSON.stringify(body)
    });
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { throw new Error(`MCP response was not JSON (${response.status}): ${text.slice(0, 200)}`); }
    return { response, payload };
  };
  const initialized = await postMcp({ jsonrpc: '2.0', method: 'initialize', id: 1, params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'c7a-unified-test', version: '1.0.0' } } }, null);
  assert.equal(initialized.response.status, 200);
  mcpSessionId = initialized.response.headers.get('mcp-session-id');
  assert.ok(mcpSessionId);
  const discovered = await postMcp({ jsonrpc: '2.0', method: 'tools/list', id: 2, params: {} });
  const toolNames = discovered.payload.result.tools.map((tool) => tool.name);
  for (const name of ['get_assessment', 'get_submission', 'list_submissions', 'export_assessment_results', 'analyze_integrity_evidence', 'record_integrity_review', 'review_grading']) assert.ok(toolNames.includes(name), `MCP tool ${name} is discoverable`);
  const callMcp = async (name, args) => {
    const result = await postMcp({ jsonrpc: '2.0', method: 'tools/call', id: `call-${name}`, params: { name, arguments: args } });
    assert.equal(result.response.status, 200);
    assert.notEqual(result.payload.result.isError, true, `${name}: ${result.payload.result.content?.[0]?.text}`);
    return JSON.parse(result.payload.result.content[0].text);
  };
  const mcpAssessment = await callMcp('get_assessment', { id: created.id, role: 'teacher', includeTeacherSolutions: true });
  assert.deepEqual(mcpAssessment.items.map(({ id, type, question_text }) => ({ id, type, question_text })), assessment.items.map(({ id, type, question_text }) => ({ id, type, question_text })));
  assert.deepEqual(mcpAssessment.items.map((item) => item.teacher_solution), dbItems.map((item) => item.teacher_solution));
  const mcpSubmissions = await callMcp('list_submissions', { assessmentId: created.id });
  assert.deepEqual(mcpSubmissions.map((submission) => submission.id).sort(), confirmed.submissions.map((submission) => submission.id).sort());
  const mcpExport = await callMcp('export_assessment_results', { assessmentId: created.id, format: 'json' });
  assert.deepEqual(mcpExport.submissions.map((submission) => submission.id).sort(), confirmed.submissions.map((submission) => submission.id).sort());
  const mcpExportResponses = mcpExport.submissions.flatMap((submission) => submission.responses.map((response) => ({
    submission_id: submission.id,
    item_id: response.item_id,
    response_text: response.response_text,
    attachment_path: response.attachment_path
  }))).sort((a, b) => a.submission_id.localeCompare(b.submission_id) || a.item_id.localeCompare(b.item_id));
  assert.deepEqual(mcpExportResponses, dbResponses, 'MCP JSON export preserves the exact response and attachment lineage');
  for (const expectedSubmission of teacherSubs.submissions) {
    const [restDetail, mcpDetail] = await Promise.all([
      teacherApi(`/api/submissions/${expectedSubmission.id}`),
      callMcp('get_submission', { submissionId: expectedSubmission.id })
    ]);
    assert.deepEqual(
      mcpDetail.responses.map(({ item_id, response_text, attachment_path }) => ({ item_id, response_text, attachment_path })).sort((a, b) => a.item_id.localeCompare(b.item_id)),
      restDetail.submission.responses.map(({ item_id, response_text, attachment_path }) => ({ item_id, response_text, attachment_path })).sort((a, b) => a.item_id.localeCompare(b.item_id)),
      `MCP and teacher REST return the same answer content for ${expectedSubmission.id}`
    );
    assert.deepEqual(
      restDetail.submission.responses.map(({ id, item_id, response_text, attachment_path }) => ({ id, item_id, response_text, attachment_path })).sort((a, b) => a.item_id.localeCompare(b.item_id)),
      dbManager.prepare('SELECT id, item_id, response_text, attachment_path FROM submission_responses WHERE submission_id = ? ORDER BY item_id').all(expectedSubmission.id).map((row) => ({ ...row })),
      `teacher REST response IDs/content match SQLite for ${expectedSubmission.id}`
    );
  }
  const mcpIntegrity = await callMcp('analyze_integrity_evidence', { assessmentId: created.id });
  assert.ok(mcpIntegrity.evidence.some((entry) => entry.id === sharedResponseEvidence.id));
  const review = await callMcp('record_integrity_review', {
    assessmentId: created.id,
    evidenceId: sharedResponseEvidence.id,
    decision: 'reviewed_no_action',
    note: 'Revisione sintetica: nessuna azione; osservazione non disciplinare.',
    idempotencyKey: 'c7a-integrity-review-001'
  });
  assert.equal(review.decision, 'reviewed_no_action');
  assert.match(review.actor, /^sha256:[a-f0-9]{32}$/i, 'review history records the verified principal pseudonym, not a raw email address');
  const reviewHistory = dbManager.prepare('SELECT assessment_id, evidence_id, decision, actor FROM integrity_review_events WHERE id = ?').get(review.id);
  assert.deepEqual({ ...reviewHistory }, { assessment_id: created.id, evidence_id: sharedResponseEvidence.id, decision: 'reviewed_no_action', actor: review.actor });
});
