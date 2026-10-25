import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createHttpApp } from '../../src/server/http.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';
import { ClassPinRateLimiter } from '../../src/server/class-pin-rate-limiter.js';

test('C7B-R3 public class portal, shared PIN, published materials and attempt recovery', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-public-portal-'));
  const secret = 'synthetic-public-portal-class-pin-secret-2026';
  const dbManager = new DatabaseManager(path.join(tmpDir, 'teacher.sqlite')).init();
  const fileStore = new FileStore(path.join(tmpDir, 'files'));
  const service = new TeacherService({ dbManager, fileStore, mockAi: true, classPinSecret: secret });
  const app = await createHttpApp({
    service,
    authMode: 'strict',
    authorizeTeacher: async () => false,
    authConfig: { webAud: 'synthetic-public-portal-audience', allowSyntheticAuth: false }
  });
  const { url } = await app.start(0, '127.0.0.1');
  const jars = new Map();

  t.after(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function request(pathname, { method = 'GET', body, token, jarName = 'default', headers = {} } = {}) {
    const jar = jars.get(jarName) || new Map();
    jars.set(jarName, jar);
    const requestHeaders = { ...headers };
    if (method !== 'GET' && method !== 'HEAD') requestHeaders.origin ||= new URL(url).origin;
    const cookie = [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
    if (cookie) requestHeaders.cookie = cookie;
    if (token) requestHeaders['X-Student-Token'] = token;
    if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
    const response = await fetch(`${url}${pathname}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const setCookies = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')].filter(Boolean);
    for (const setCookie of setCookies) {
      const firstPair = setCookie.split(';', 1)[0];
      const equals = firstPair.indexOf('=');
      if (equals > 0) jar.set(firstPair.slice(0, equals), firstPair.slice(equals + 1));
    }
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    return { response, payload };
  }

  const classA = service.createClass({ name: '4A Reti', academicYear: '2026/2027' });
  const classB = service.createClass({ name: '4B Reti', academicYear: '2026/2027' });
  const subjectA = service.createSubject({ classId: classA.id, name: 'Reti' });
  const studentA = service.addStudent({ classId: classA.id, firstName: 'Ada', lastName: 'Rossi' });
  const studentA2 = service.addStudent({ classId: classA.id, firstName: 'Luca', lastName: 'Bianchi' });
  const studentB = service.addStudent({ classId: classB.id, firstName: 'Nina', lastName: 'Verdi' });

  const published = service.createMaterial({
    title: 'Appunti pubblici',
    contentText: '# Reti\n\nContenuto consultabile dagli studenti.',
    classId: classA.id,
    pedagogicalRole: 'student_material',
    resourceType: 'student_note'
  });
  service.publishMaterial(published.id, { versionNumber: 1, publishedBy: 'synthetic-teacher' });
  const withdrawn = service.createMaterial({
    title: 'Dispensa ritirata',
    contentText: 'Non più disponibile.',
    classId: classA.id,
    pedagogicalRole: 'student_material',
    resourceType: 'student_note'
  });
  service.publishMaterial(withdrawn.id, { versionNumber: 1, publishedBy: 'synthetic-teacher' });
  service.unpublishMaterial(withdrawn.id, { versionNumber: 1, unpublishedBy: 'synthetic-teacher' });
  const privateMaterial = service.createMaterial({
    title: 'Note riservate docente',
    contentText: 'Testo che non deve uscire nell’area studente.',
    classId: classA.id,
    pedagogicalRole: 'teacher_material',
    resourceType: 'teacher_script'
  });

  const active = service.createAssessment({
    title: 'Prova attiva',
    description: 'Visibile solo dopo il PIN.',
    classId: classA.id,
    subjectId: subjectA.id,
    status: 'active',
    durationMinutes: 60,
    maxScore: 10,
    items: [{
      type: 'open_short',
      questionText: 'Spiega il routing.',
      maxScore: 10,
      teacherSolution: 'Soluzione riservata al docente.'
    }]
  });
  const draft = service.createAssessment({ title: 'Bozza nascosta', classId: classA.id, status: 'draft' });
  const itemId = dbManager.prepare('SELECT id FROM assessment_items WHERE assessment_id = ?').get(active.id).id;

  const adminRead = await request(`/api/classes/${encodeURIComponent(classA.id)}/activity-pin`);
  assert.equal(adminRead.response.status, 401, 'PIN management remains behind teacher authorization');
  const publicClasses = await request('/api/student/classes');
  assert.equal(publicClasses.response.status, 200);
  assert.ok(publicClasses.payload.classes.some((item) => item.id === classA.id));
  assert.ok(publicClasses.payload.classes.some((item) => item.id === classB.id));

  const publicMaterialList = await request(`/api/student/classes/${classA.id}/materials`);
  assert.equal(publicMaterialList.response.status, 200);
  assert.deepEqual(publicMaterialList.payload.materials.map((material) => material.id), [published.id]);
  assert.ok(!JSON.stringify(publicMaterialList.payload).includes(privateMaterial.id));
  const publicMaterial = await request(`/api/student/classes/${classA.id}/materials/${published.id}/versions/1`);
  assert.equal(publicMaterial.response.status, 200);
  assert.equal(publicMaterial.payload.material.content, '# Reti\n\nContenuto consultabile dagli studenti.');
  assert.ok(!JSON.stringify(publicMaterial.payload).includes('file_path'));
  const publicDownload = await request(`/api/student/classes/${classA.id}/materials/${published.id}/versions/1/download`);
  assert.equal(publicDownload.response.status, 200);
  assert.match(publicDownload.response.headers.get('content-disposition'), /^attachment;/);
  assert.match(publicDownload.payload, /Contenuto consultabile/);
  const privateMaterialRead = await request(`/api/student/classes/${classA.id}/materials/${privateMaterial.id}/versions/1`);
  assert.equal(privateMaterialRead.response.status, 404);

  const generatedA = service.generateClassActivityPin(classA.id, { createdBy: 'synthetic-teacher' });
  const generatedB = service.generateClassActivityPin(classB.id, { createdBy: 'synthetic-teacher' });
  assert.match(generatedA.pin, /^\d{4}$/);
  assert.match(generatedB.pin, /^\d{4}$/);
  assert.ok(!JSON.stringify(service.getClassActivityPinStatus(classA.id)).includes(generatedA.pin));

  const anonymousActivities = await request(`/api/student/classes/${classA.id}/activities`);
  assert.equal(anonymousActivities.response.status, 401);
  assert.ok(!JSON.stringify(anonymousActivities.payload).includes(active.title));
  const anonymousRoster = await request(`/api/student/classes/${classA.id}/students`);
  assert.equal(anonymousRoster.response.status, 404, 'the old unscoped class roster endpoint is removed');
  const wrongPin = await request(`/api/student/classes/${classA.id}/access`, { method: 'POST', body: { pin: '9999' }, jarName: 'student-a' });
  assert.equal(wrongPin.response.status, 403);
  const classBWrongPin = await request(`/api/student/classes/${classB.id}/access`, { method: 'POST', body: { pin: generatedA.pin }, jarName: 'student-b' });
  assert.equal(classBWrongPin.response.status, 403, 'a PIN hash is bound to its own class');

  const entered = await request(`/api/student/classes/${classA.id}/access`, { method: 'POST', body: { pin: generatedA.pin }, jarName: 'student-a' });
  assert.equal(entered.response.status, 200, JSON.stringify(entered.payload));
  assert.equal(entered.payload.class.id, classA.id);
  assert.ok(!(entered.response.headers.get('set-cookie') || '').includes(generatedA.pin));
  const activities = await request(`/api/student/classes/${classA.id}/activities`, { jarName: 'student-a' });
  assert.equal(activities.response.status, 200);
  assert.deepEqual(activities.payload.activities.map((activity) => activity.id), [active.id]);
  assert.ok(!activities.payload.activities.some((activity) => activity.id === draft.id));
  const roster = await request(`/api/student/classes/${classA.id}/activities/${active.id}/students`, { jarName: 'student-a' });
  assert.equal(roster.response.status, 200);
  assert.deepEqual(roster.payload.students.map((student) => student.fullName), ['Luca Bianchi', 'Ada Rossi']);
  const neighbors = await request(`/api/student/classes/${classA.id}/activities/${active.id}/neighbors?studentId=${studentA.id}`, { jarName: 'student-a' });
  assert.equal(neighbors.response.status, 200);
  assert.ok(neighbors.payload.neighbors.some((neighbor) => neighbor.id === 'none'));
  assert.ok(neighbors.payload.neighbors.some((neighbor) => neighbor.fullName === 'Luca Bianchi'));

  const started = await request(`/api/student/classes/${classA.id}/activities/${active.id}/start`, {
    method: 'POST',
    jarName: 'student-a',
    body: { studentId: studentA.id, seatRow: 'Fila 2', seatDesk: 'Banco 3', leftNeighborId: 'none', rightNeighborId: studentA2.id }
  });
  assert.equal(started.response.status, 201);
  assert.equal(started.payload.session.studentId, studentA.id);
  const attemptToken = started.payload.session.token;
  const initialSubmissionId = started.payload.submission.id;
  const initialExpiry = started.payload.submission.timer.expires_at;
  const studentActivity = await request(`/api/student/activities/${active.id}`, { token: attemptToken });
  assert.equal(studentActivity.response.status, 200);
  assert.equal(studentActivity.payload.activity.items[0].id, itemId);
  assert.ok(!JSON.stringify(studentActivity.payload).includes('Soluzione riservata'));
  assert.ok(!JSON.stringify(studentActivity.payload).includes(privateMaterial.content));

  const autosaved = await request(`/api/student/activities/${active.id}/autosave`, {
    method: 'POST',
    token: attemptToken,
    body: { revision: 2, responses: [{ itemId, responseText: 'Risposta sintetica.' }] }
  });
  assert.equal(autosaved.response.status, 200);
  assert.equal(autosaved.payload.revision, 2);
  const persistedDraft = await request("/api/student/activities/" + active.id + "/submission", { token: attemptToken });
  assert.equal(persistedDraft.response.status, 200);
  assert.equal(persistedDraft.payload.submission.revision, 2);
  assert.equal(persistedDraft.payload.submission.responses[0].response_text, 'Risposta sintetica.');

  const rotated = service.generateClassActivityPin(classA.id, { createdBy: 'synthetic-teacher' });
  assert.match(rotated.pin, /^\d{4}$/);
  const revokedClassSession = await request(`/api/student/classes/${classA.id}/activities`, { jarName: 'student-a' });
  assert.equal(revokedClassSession.response.status, 401);
  const inProgressTokenStillValid = await request('/api/student/session', { token: attemptToken });
  assert.equal(inProgressTokenStillValid.response.status, 200, 'PIN rotation does not revoke an already-started attempt');

  const reentered = await request(`/api/student/classes/${classA.id}/access`, { method: 'POST', body: { pin: rotated.pin }, jarName: 'student-a' });
  assert.equal(reentered.response.status, 200);
  const resumedActivities = await request(`/api/student/classes/${classA.id}/activities`, { jarName: 'student-a' });
  assert.equal(resumedActivities.response.status, 200);
  const resumed = await request(`/api/student/classes/${classA.id}/activities/${active.id}/start`, {
    method: 'POST',
    jarName: 'student-a',
    body: { studentId: studentA.id, seatRow: 'Fila 2', seatDesk: 'Banco 3', leftNeighborId: 'none', rightNeighborId: studentA2.id }
  });
  assert.equal(resumed.response.status, 200);
  assert.equal(resumed.payload.status, 'resumed');
  assert.equal(resumed.payload.submission.id, initialSubmissionId);
  assert.equal(resumed.payload.submission.responses[0].response_text, 'Risposta sintetica.');
  assert.equal(resumed.payload.submission.timer.expires_at, initialExpiry, 're-entry does not reset the authoritative timer');

  const submitted = await request(`/api/student/activities/${active.id}/submit`, {
    method: 'POST',
    token: resumed.payload.session.token,
    body: { revision: 3, responses: [{ itemId, responseText: 'Risposta consegnata.' }] }
  });
  assert.equal(submitted.response.status, 200);
  assert.equal(submitted.payload.submission.attempt_status, 'submitted');
  const lateSave = await request(`/api/student/activities/${active.id}/autosave`, {
    method: 'POST',
    token: resumed.payload.session.token,
    body: { revision: 4, responses: [{ itemId, responseText: 'Tentativo tardivo.' }] }
  });
  assert.equal(lateSave.response.status, 409);
  assert.equal(service.getStudentSubmission(active.id, studentA.id).responses[0].response_text, 'Risposta consegnata.');

  const legacyClaim = await request('/api/student/claim-code', { method: 'POST', body: { accessCode: 'LEGACY' } });
  assert.equal(legacyClaim.response.status, 410);
});

test('class PIN limiter allows classroom NAT typos while retaining per-device protection', () => {
  const dbManager = new DatabaseManager(':memory:').init();
  const limiter = new ClassPinRateLimiter(dbManager);
  for (let learner = 0; learner < 30; learner += 1) {
    for (let typo = 0; typo < 2; typo += 1) {
      const attempt = { classId: 'class-nat', ip: '198.51.100.21', deviceId: `device-${learner}`, now: 1000 + learner * 10 + typo };
      assert.equal(limiter.check(attempt).blocked, false);
      limiter.recordFailure(attempt);
    }
  }
  assert.equal(limiter.check({ classId: 'class-nat', ip: '198.51.100.21', deviceId: 'another-device', now: 2000 }).blocked, false);
  for (let count = 0; count < 8; count += 1) {
    const attempt = { classId: 'class-device', ip: null, deviceId: 'same-device', now: 5000 + count };
    if (count < 7) assert.equal(limiter.check(attempt).blocked, false);
    limiter.recordFailure(attempt);
  }
  assert.equal(limiter.check({ classId: 'class-device', ip: null, deviceId: 'same-device', now: 6000 }).blocked, true);
  dbManager.close();
});
