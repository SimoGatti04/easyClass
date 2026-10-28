import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';

import { createHttpApp } from '../../src/server/http.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';

test('C7B-G2-R1 Task A: Student end-to-end full workflow on isolated synthetic environment', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-e2e-isolated-'));
  const dbPath = path.join(tmpDir, 'teacher-isolated.sqlite');
  const filesPath = path.join(tmpDir, 'filestore');
  fs.mkdirSync(filesPath, { recursive: true });

  const classPinSecret = 'synthetic-isolated-pin-secret-2026-high-entropy-bytes';
  const dbManager = new DatabaseManager(dbPath).init();
  const fileStore = new FileStore(filesPath);
  const service = new TeacherService({
    dbManager,
    fileStore,
    mockAi: true,
    classPinSecret
  });

  // Setup synthetic class & subject
  const syntheticClass = service.createClass({
    name: '5A Informatica — R3 Isolated',
    section: 'A',
    academicYear: '2026/2027'
  });
  const syntheticSubject = service.createSubject({
    classId: syntheticClass.id,
    name: 'Sistemi e Reti'
  });

  // Setup two distinct synthetic students
  const student1 = service.addStudent({
    classId: syntheticClass.id,
    firstName: 'Mario',
    lastName: 'Rossi',
    email: 'mario.rossi@scuola.test'
  });
  const student2 = service.addStudent({
    classId: syntheticClass.id,
    firstName: 'Giulia',
    lastName: 'Verdi',
    email: 'giulia.verdi@scuola.test'
  });

  // Setup materials: published vs unpublished vs teacher-only
  const publishedMaterial = service.createMaterial({
    title: 'Architettura dei Calcolatori',
    contentText: '# Architettura dei Calcolatori\nModello di von Neumann con CPU, memoria e bus.',
    pedagogicalRole: 'student_material',
    classId: syntheticClass.id,
    subjectId: syntheticSubject.id
  });
  service.publishMaterial(publishedMaterial.id, { versionNumber: 1, publishedBy: 'synthetic-teacher' });

  const unpublishedMaterial = service.createMaterial({
    title: 'Bozza Riservata Non Pubblicata',
    contentText: 'Questo materiale non deve essere visibile agli studenti.',
    pedagogicalRole: 'student_material',
    classId: syntheticClass.id,
    subjectId: syntheticSubject.id
  });

  const teacherMaterial = service.createMaterial({
    title: 'Soluzioni e Guida Docente',
    contentText: 'Soluzioni ufficiali e rubriche di correzione protette.',
    pedagogicalRole: 'teacher_material',
    classId: syntheticClass.id,
    subjectId: syntheticSubject.id
  });

  // Setup activity with PIN & two items (including one with attachment)
  const assessment = service.createAssessment({
    title: 'Verifica Sistemi e Architetture',
    description: 'Verifica scritta su architetture dei calcolatori e bus.',
    classId: syntheticClass.id,
    subjectId: syntheticSubject.id,
    activityType: 'test',
    status: 'active',
    durationMinutes: 45,
    maxScore: 30,
    items: [
      {
        type: 'open_short',
        questionText: 'Descrivi la funzione del Program Counter (PC) nella CPU.',
        maxScore: 10,
        isSelfCorrecting: false,
        assessableSourceId: publishedMaterial.id,
        assessableSourceVersion: 1,
        teacherSolution: 'Contiene l’indirizzo di memoria della prossima istruzione da eseguire.'
      },
      {
        type: 'attachment',
        questionText: 'Allega il diagramma a blocchi dell’architettura in formato testuale o SQL.',
        maxScore: 20,
        isSelfCorrecting: false,
        assessableSourceId: publishedMaterial.id,
        assessableSourceVersion: 1,
        teacherSolution: 'Schema con CPU (ALU, CU, registri), memoria primaria e bus indirizzi/dati/controllo.'
      }
    ]
  });

  const activeAssessmentId = assessment.id;
  const item1Id = assessment.items[0].id;
  const item2Id = assessment.items[1].id;

  // Generate valid Class PIN
  const pinObj = service.generateClassActivityPin(syntheticClass.id, { createdBy: 'synthetic-teacher' });
  const validPin = pinObj.pin;
  assert.match(validPin, /^\d{4}$/, 'Class PIN must be exactly 4 digits');

  // Create HTTP application with strict auth
  const teacherEmail = 'teacher@school.example';
  const app = await createHttpApp({
    service,
    authMode: 'strict',
    authorizeTeacher: async (auth) => auth.user?.email === teacherEmail,
    authConfig: {
      webAud: 'synthetic-isolated-aud',
      expectedIss: 'https://auth.simogatti.it',
      allowSyntheticAuth: false
    }
  });

  let serverBinding;
  try {
    serverBinding = await app.start(0, '127.0.0.1');
  } catch (err) {
    if (err?.code === 'EPERM') {
      t.skip('Sandbox policy denied loopback bind; run with elevated permission to test real HTTP');
      return;
    }
    throw err;
  }

  const { url } = serverBinding;
  const cookieJars = new Map();

  t.after(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Client helper for executing HTTP requests against real loopback
  async function makeRequest(pathname, {
    method = 'GET',
    body,
    token,
    jarName = 'default',
    headers = {},
    rawBody = false,
    contentType = null
  } = {}) {
    const jar = cookieJars.get(jarName) || new Map();
    cookieJars.set(jarName, jar);
    const reqHeaders = { ...headers };
    if (method !== 'GET' && method !== 'HEAD') {
      reqHeaders.origin ||= new URL(url).origin;
      reqHeaders.referer ||= `${new URL(url).origin}/studente`;
    }
    const cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) reqHeaders.cookie = cookie;
    if (token) reqHeaders['X-Student-Token'] = token;

    let sendBody = undefined;
    if (body !== undefined) {
      if (rawBody) {
        sendBody = body;
        if (contentType) reqHeaders['Content-Type'] = contentType;
      } else {
        sendBody = JSON.stringify(body);
        reqHeaders['Content-Type'] = 'application/json';
      }
    }

    const res = await fetch(`${url}${pathname}`, {
      method,
      headers: reqHeaders,
      body: sendBody
    });

    const setCookies = res.headers.getSetCookie?.() || [res.headers.get('set-cookie')].filter(Boolean);
    for (const setCookie of setCookies) {
      const firstPair = setCookie.split(';', 1)[0];
      const eqIdx = firstPair.indexOf('=');
      if (eqIdx > 0) jar.set(firstPair.slice(0, eqIdx), firstPair.slice(eqIdx + 1));
    }

    const ct = res.headers.get('content-type') || '';
    const payload = ct.includes('application/json') ? await res.json() : await res.text();
    return { status: res.status, headers: res.headers, payload };
  }

  // -------------------------------------------------------------
  // 1. Accesso pubblico alla classe
  // -------------------------------------------------------------
  const publicClassesRes = await makeRequest('/api/student/classes');
  assert.equal(publicClassesRes.status, 200, 'Public class directory must be accessible without auth');
  const classItem = publicClassesRes.payload.classes.find(c => c.id === syntheticClass.id);
  assert.ok(classItem, 'Synthetic class must be listed in public class directory');
  assert.equal(classItem.name, '5A Informatica — R3 Isolated');
  assert.equal(classItem.section, 'A');
  assert.equal(classItem.academicYear, '2026/2027');

  // -------------------------------------------------------------
  // 2. Visibilità del materiale pubblicato
  // -------------------------------------------------------------
  const materialsRes = await makeRequest(`/api/student/classes/${syntheticClass.id}/materials`);
  assert.equal(materialsRes.status, 200, 'Published materials list must be publicly accessible');
  assert.equal(materialsRes.payload.materials.length, 1);
  assert.equal(materialsRes.payload.materials[0].id, publishedMaterial.id);
  assert.equal(materialsRes.payload.materials[0].title, 'Architettura dei Calcolatori');

  const materialContentRes = await makeRequest(`/api/student/classes/${syntheticClass.id}/materials/${publishedMaterial.id}/versions/1`);
  assert.equal(materialContentRes.status, 200);
  assert.equal(materialContentRes.payload.material.title, 'Architettura dei Calcolatori');
  assert.match(materialContentRes.payload.material.content, /Modello di von Neumann/);
  // Ensure internal storage paths are never leaked
  assert.ok(!JSON.stringify(materialContentRes.payload).includes('file_path'));

  // -------------------------------------------------------------
  // 3. Esclusione di materiali non pubblicati e soluzioni docente
  // -------------------------------------------------------------
  const unpubRes = await makeRequest(`/api/student/classes/${syntheticClass.id}/materials/${unpublishedMaterial.id}/versions/1`);
  assert.equal(unpubRes.status, 404, 'Unpublished material must return 404 Not Found to students');

  const teacherMatRes = await makeRequest(`/api/student/classes/${syntheticClass.id}/materials/${teacherMaterial.id}/versions/1`);
  assert.equal(teacherMatRes.status, 404, 'Teacher material must return 404 Not Found to students');

  // -------------------------------------------------------------
  // 4. Rifiuto del PIN errato
  // -------------------------------------------------------------
  const wrongPinRes = await makeRequest(`/api/student/classes/${syntheticClass.id}/access`, {
    method: 'POST',
    body: { pin: '0000' },
    jarName: 'student1'
  });
  assert.equal(wrongPinRes.status, 403, 'Invalid PIN must be rejected with 403 Forbidden');
  assert.match(wrongPinRes.payload.message, /Codice classe non valido/);

  // Attempting to list activities without valid PIN cookie fails with 401
  const unauthActivitiesRes = await makeRequest(`/api/student/classes/${syntheticClass.id}/activities`, {
    jarName: 'student1'
  });
  assert.equal(unauthActivitiesRes.status, 401, 'Accessing activities without valid PIN cookie must return 401');

  // -------------------------------------------------------------
  // 5. Riscatto positivo del PIN corretto
  // -------------------------------------------------------------
  const validPinRes = await makeRequest(`/api/student/classes/${syntheticClass.id}/access`, {
    method: 'POST',
    body: { pin: validPin },
    jarName: 'student1'
  });
  assert.equal(validPinRes.status, 200, 'Valid PIN must return 200 OK');
  assert.equal(validPinRes.payload.status, "ok");
  assert.equal(validPinRes.payload.class.id, syntheticClass.id);

  // -------------------------------------------------------------
  // 6. Visualizzazione attività e nominativi
  // -------------------------------------------------------------
  const activitiesRes = await makeRequest(`/api/student/classes/${syntheticClass.id}/activities`, {
    jarName: 'student1'
  });
  assert.equal(activitiesRes.status, 200);
  assert.equal(activitiesRes.payload.activities.length, 1);
  assert.equal(activitiesRes.payload.activities[0].id, activeAssessmentId);
  assert.equal(activitiesRes.payload.activities[0].title, 'Verifica Sistemi e Architetture');

  const rosterRes = await makeRequest(`/api/student/classes/${syntheticClass.id}/activities/${activeAssessmentId}/students`, {
    jarName: 'student1'
  });
  assert.equal(rosterRes.status, 200);
  assert.equal(rosterRes.payload.students.length, 2);
  const studentNames = rosterRes.payload.students.map(s => s.fullName);
  assert.ok(studentNames.includes('Mario Rossi'));
  assert.ok(studentNames.includes('Giulia Verdi'));

  // -------------------------------------------------------------
  // 7. Avvio del tentativo studente (Student 1: Mario Rossi)
  // -------------------------------------------------------------
  const startRes = await makeRequest(`/api/student/classes/${syntheticClass.id}/activities/${activeAssessmentId}/start`, {
    method: 'POST',
    jarName: 'student1',
    body: {
      studentId: student1.id,
      seatRow: 'Fila 1',
      seatDesk: 'Banco 4',
      leftNeighborId: 'none',
      rightNeighborId: student2.id
    }
  });
  assert.equal(startRes.status, 201, 'Starting attempt must return 201 Created');
  assert.equal(startRes.payload.status, 'started');
  assert.equal(startRes.payload.session.studentId, student1.id);
  const student1Token = startRes.payload.session.token;
  const submissionId = startRes.payload.submission.id;
  const initialExpiresAt = startRes.payload.submission.timer.expires_at;
  assert.ok(student1Token, 'Must receive student token');
  assert.ok(submissionId, 'Must receive submission ID');
  assert.ok(new Date(initialExpiresAt).getTime() > Date.now(), 'Expires_at must be in the future');

  // Verify that assessment details returned to student do NOT contain teacher solutions
  const studentActivityRes = await makeRequest(`/api/student/activities/${activeAssessmentId}`, {
    token: student1Token
  });
  assert.equal(studentActivityRes.status, 200);
  assert.equal(studentActivityRes.payload.activity.items.length, 2);
  for (const item of studentActivityRes.payload.activity.items) {
    assert.ok(!item.teacher_solution, 'teacher_solution must be stripped or null');
    assert.ok(!item.teacherSolution, 'teacherSolution must be stripped or null');
  }

  // -------------------------------------------------------------
  // 8. Salvataggio parziale (Autosave)
  // -------------------------------------------------------------
  const autosave1Res = await makeRequest(`/api/student/activities/${activeAssessmentId}/autosave`, {
    method: 'POST',
    token: student1Token,
    body: {
      revision: 2,
      responses: [
        { itemId: item1Id, responseText: 'Il Program Counter memorizza l’indirizzo della prossima istruzione da prelevare dalla RAM.' }
      ]
    }
  });
  assert.equal(autosave1Res.status, 200, 'Autosave must succeed with 200');
  assert.equal(autosave1Res.payload.revision, 2);

  // Verify draft read
  const draftReadRes = await makeRequest(`/api/student/activities/${activeAssessmentId}/submission`, {
    token: student1Token
  });
  assert.equal(draftReadRes.status, 200);
  assert.equal(draftReadRes.payload.submission.revision, 2);
  assert.equal(draftReadRes.payload.submission.responses[0].response_text, 'Il Program Counter memorizza l’indirizzo della prossima istruzione da prelevare dalla RAM.');

  // -------------------------------------------------------------
  // 9. Ripresa dopo ricaricamento e nuova sessione browser
  // -------------------------------------------------------------
  // Student 1 loses in-memory token, returns to portal with only class PIN cookie
  const resumeRes = await makeRequest(`/api/student/classes/${syntheticClass.id}/activities/${activeAssessmentId}/start`, {
    method: 'POST',
    jarName: 'student1',
    body: {
      studentId: student1.id,
      seatRow: 'Fila 1',
      seatDesk: 'Banco 4',
      leftNeighborId: 'none',
      rightNeighborId: student2.id
    }
  });
  assert.equal(resumeRes.status, 200, 'Resuming active attempt must return 200 OK');
  assert.equal(resumeRes.payload.status, 'resumed');
  assert.equal(resumeRes.payload.submission.id, submissionId);
  assert.equal(resumeRes.payload.submission.revision, 2);
  assert.equal(resumeRes.payload.submission.responses[0].response_text, 'Il Program Counter memorizza l’indirizzo della prossima istruzione da prelevare dalla RAM.');
  const resumedToken = resumeRes.payload.session.token;
  assert.ok(resumedToken);

  // -------------------------------------------------------------
  // 10. Conservazione del timer originario
  // -------------------------------------------------------------
  const resumedExpiresAt = resumeRes.payload.submission.timer.expires_at;
  assert.equal(resumedExpiresAt, initialExpiresAt, 'Authoritative timer expires_at must be strictly conserved upon re-entry');

  // -------------------------------------------------------------
  // 11. Upload e recupero di un allegato
  // -------------------------------------------------------------
  const boundary = `----IsolatedTestBoundary${Date.now()}`;
  const fileContent = 'CPU [ALU, CU, REG] <---> BUS (Dati, Indirizzi, Controllo) <---> RAM (Memoria)';
  const fileBuffer = Buffer.from(fileContent, 'utf-8');
  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="assessmentId"\r\n\r\n${activeAssessmentId}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="itemId"\r\n\r\n${item2Id}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="schema-architettura.txt"\r\nContent-Type: text/plain\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  const uploadRes = await makeRequest('/api/student/upload', {
    method: 'POST',
    token: resumedToken,
    rawBody: true,
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: multipartBody
  });
  assert.equal(uploadRes.status, 201, 'Attachment upload must return 201 Created');
  assert.equal(uploadRes.payload.success, true);
  const attachmentId = uploadRes.payload.attachmentId;
  assert.ok(attachmentId, 'Must return assigned attachment ID');
  assert.equal(uploadRes.payload.attachmentName, 'schema-architettura.txt');

  // Retrieve attachment
  const downloadAttachmentRes = await makeRequest(`/api/student/attachment?assessmentId=${encodeURIComponent(activeAssessmentId)}&attachmentId=${encodeURIComponent(attachmentId)}`, {
    token: resumedToken
  });
  assert.equal(downloadAttachmentRes.status, 200, 'Student must be able to retrieve own uploaded attachment');
  assert.equal(downloadAttachmentRes.payload, fileContent, 'Retrieved attachment content must match original uploaded bytes');
  assert.match(downloadAttachmentRes.headers.get('content-disposition'), /schema-architettura\.txt/);

  // Link attachment to Question 2 in autosave (revision 3)
  const autosave2Res = await makeRequest(`/api/student/activities/${activeAssessmentId}/autosave`, {
    method: 'POST',
    token: resumedToken,
    body: {
      revision: 3,
      responses: [
        { itemId: item1Id, responseText: 'Il Program Counter memorizza l’indirizzo della prossima istruzione da prelevare dalla RAM.' },
        { itemId: item2Id, responseText: 'Schema architetturale allegato nel file di testo.', attachmentId }
      ]
    }
  });
  assert.equal(autosave2Res.status, 200);
  assert.equal(autosave2Res.payload.revision, 3);

  // -------------------------------------------------------------
  // 12. Consegna definitiva e impossibilità di ulteriori modifiche
  // -------------------------------------------------------------
  const finalSubmitRes = await makeRequest(`/api/student/activities/${activeAssessmentId}/submit`, {
    method: 'POST',
    token: resumedToken,
    body: {
      revision: 4,
      responses: [
        { itemId: item1Id, responseText: 'Il Program Counter memorizza l’indirizzo della prossima istruzione da prelevare dalla RAM.' },
        { itemId: item2Id, responseText: 'Schema architetturale allegato nel file di testo.', attachmentId }
      ]
    }
  });
  assert.equal(finalSubmitRes.status, 200, 'Final submission must return 200 OK');
  assert.equal(finalSubmitRes.payload.status, 'submitted');
  assert.equal(finalSubmitRes.payload.submission.attempt_status, 'submitted');

  // Attempting any subsequent autosave is strictly rejected with 409 Conflict
  const postSubmitAutosaveRes = await makeRequest(`/api/student/activities/${activeAssessmentId}/autosave`, {
    method: 'POST',
    token: resumedToken,
    body: {
      revision: 5,
      responses: [{ itemId: item1Id, responseText: 'Modifica tardiva non consentita.' }]
    }
  });
  assert.equal(postSubmitAutosaveRes.status, 409, 'Autosave after final submission must be rejected with 409 Conflict');
  assert.match(postSubmitAutosaveRes.payload.message, /Consegna già finalizzata ed immutabile/i);

  // Attempting any subsequent submit is strictly rejected with 409 Conflict
  const postSubmitSubmitRes = await makeRequest(`/api/student/activities/${activeAssessmentId}/submit`, {
    method: 'POST',
    token: resumedToken,
    body: {
      revision: 5,
      responses: [{ itemId: item1Id, responseText: 'Riconsegna non consentita.' }]
    }
  });
  assert.equal(postSubmitSubmitRes.status, 409, 'Submitting after final submission must be rejected with 409 Conflict');

  // -------------------------------------------------------------
  // 13. Isolamento tra studenti, tentativi e classi
  // -------------------------------------------------------------
  // Student 2 (Giulia Verdi) redeems PIN in own session
  const pinRes2 = await makeRequest(`/api/student/classes/${syntheticClass.id}/access`, {
    method: 'POST',
    body: { pin: validPin },
    jarName: 'student2'
  });
  assert.equal(pinRes2.status, 200);

  // Student 2 starts attempt
  const startRes2 = await makeRequest(`/api/student/classes/${syntheticClass.id}/activities/${activeAssessmentId}/start`, {
    method: 'POST',
    jarName: 'student2',
    body: {
      studentId: student2.id,
      seatRow: 'Fila 2',
      seatDesk: 'Banco 1',
      leftNeighborId: student1.id,
      rightNeighborId: 'none'
    }
  });
  assert.equal(startRes2.status, 201);
  const student2Token = startRes2.payload.session.token;
  assert.notEqual(student2Token, resumedToken, 'Student 2 must receive a completely distinct session token');

  // Student 2 reading own submission sees blank/started submission, NOT Student 1's answers
  const student2SubRes = await makeRequest(`/api/student/activities/${activeAssessmentId}/submission`, {
    token: student2Token
  });
  assert.equal(student2SubRes.status, 200);
  assert.equal(student2SubRes.payload.submission.student_id, student2.id);
  assert.notEqual(student2SubRes.payload.submission.id, submissionId);
  assert.equal(student2SubRes.payload.submission.attempt_status, 'in_progress');

  // Student 2 attempts to download Student 1's attachment: rejected fail-closed (403 or 404)
  const crossAttachmentRes = await makeRequest(`/api/student/attachment?assessmentId=${encodeURIComponent(activeAssessmentId)}&attachmentId=${encodeURIComponent(attachmentId)}`, {
    token: student2Token
  });
  assert.ok([403, 404].includes(crossAttachmentRes.status), `Cross-student attachment access must be denied fail-closed, got ${crossAttachmentRes.status}`);

  // -------------------------------------------------------------
  // 14. Verifica di coerenza SQLite/FileStore
  // -------------------------------------------------------------
  // 14a. SQLite database PRAGMA integrity_check
  const integrityCheck = dbManager.prepare('PRAGMA integrity_check').get();
  assert.equal(integrityCheck.integrity_check, 'ok', 'SQLite store integrity check must return "ok"');

  // 14b. Submissions in DB
  const subs = dbManager.prepare('SELECT id, student_id, attempt_status, revision FROM assessment_submissions WHERE assessment_id = ? ORDER BY student_id').all(activeAssessmentId);
  assert.equal(subs.length, 2, 'Exactly 2 student submissions must be recorded in SQLite');
  const sub1 = subs.find(s => s.student_id === student1.id);
  const sub2 = subs.find(s => s.student_id === student2.id);
  assert.equal(sub1.attempt_status, 'submitted');
  assert.equal(sub1.revision, 4);
  assert.equal(sub2.attempt_status, 'in_progress');

  // 14c. FileStore on disk verification
  const attachmentRecord = dbManager.prepare('SELECT id, student_id, original_name, storage_path, size_bytes FROM student_attachments WHERE id = ?').get(attachmentId);
  assert.ok(attachmentRecord, 'Attachment record must exist in database');
  assert.equal(attachmentRecord.student_id, student1.id);
  assert.equal(attachmentRecord.size_bytes, fileBuffer.length);

  // Read actual file from disk through FileStore
  const storedFile = fileStore.readStoredFile(attachmentRecord.storage_path);
  assert.equal(storedFile.size, fileBuffer.length, 'Stored file size on disk must match original buffer');
  assert.equal(storedFile.buffer.toString('utf-8'), fileContent, 'Stored file content on disk must match original content');

  // Compute SHA-256 of file on disk
  const diskSha256 = crypto.createHash('sha256').update(storedFile.buffer).digest('hex');
  // SHA-256 verified directly from FileStore stored bytes
  assert.equal(diskSha256, crypto.createHash("sha256").update(Buffer.from(fileContent, "utf-8")).digest("hex"));
});
