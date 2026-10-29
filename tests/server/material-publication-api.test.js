import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createHttpApp } from '../../src/server/http.js';
import { setTestAuthKeys, clearJwksCache } from '../../src/server/auth.js';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';

function createJwtFixtures(emails) {
  const keys = new Map();
  const tokens = new Map();
  for (const email of emails) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    const keyId = `publication-api-${email}-${process.pid}`;
    keys.set(keyId, crypto.createPublicKey(publicKey));
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: keyId })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: 'https://simogatti.cloudflareaccess.com',
      aud: ['teacher-service-publication-api-aud'],
      sub: email,
      email,
      nbf: now - 10,
      iat: now,
      exp: now + 3600
    })).toString('base64url');
    const body = `${header}.${payload}`;
    tokens.set(email, `${body}.${crypto.createSign('RSA-SHA256').update(body).sign(privateKey, 'base64url')}`);
  }
  setTestAuthKeys({ keys });
  return tokens;
}

function addMaterial(service, { classId, subjectId, lessonId, title, role, type, contentText }) {
  return service.createMaterial({
    title,
    contentText,
    pedagogicalRole: role,
    resourceType: type,
    classId,
    subjectId,
    lessonId
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

test('version-bound teacher publication API enforces authorization, eligibility, idempotence, expiry and student visibility', async (t) => {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-publication-api-'));
  const dbManager = new DatabaseManager(path.join(runRoot, 'teacher-service.sqlite')).init();
  const fileStore = new FileStore(path.join(runRoot, 'filestore'));
  const service = new TeacherService({ dbManager, fileStore, mockAi: true });
  const teacherEmail = 'publication-teacher@example.test';
  const unauthorizedEmail = 'not-a-teacher@example.test';
  const tokens = createJwtFixtures([teacherEmail, unauthorizedEmail]);
  const classroom = service.createClass({ name: 'Classe sintetica UX2-C', academicYear: '2026/2027' });
  const subject = service.createSubject({ classId: classroom.id, name: 'Scienze sintetiche' });
  const lesson = service.createLesson({
    classId: classroom.id,
    subjectId: subject.id,
    title: 'Materiali e disponibilità',
    date: '2026-11-10',
    durationMinutes: 45
  });
  const studentMaterial = addMaterial(service, {
    classId: classroom.id,
    subjectId: subject.id,
    lessonId: lesson.id,
    title: 'Scheda studenti UX2-C',
    role: 'student_material',
    type: 'student_note',
    contentText: 'Contenuto disponibile agli studenti. [TEACHER_ONLY_SOLUTION] risposta riservata [/TEACHER_ONLY_SOLUTION]'
  });
  const supportMaterial = addMaterial(service, {
    classId: classroom.id,
    subjectId: subject.id,
    lessonId: lesson.id,
    title: 'Esercizio di supporto UX2-C',
    role: 'support_material',
    type: 'exercise_sheet',
    contentText: 'Esercizio sintetico senza soluzioni.'
  });
  const teacherOnly = addMaterial(service, {
    classId: classroom.id,
    subjectId: subject.id,
    lessonId: lesson.id,
    title: 'Soluzioni docente UX2-C',
    role: 'teacher_material',
    type: 'custom',
    contentText: 'Contenuto riservato al docente.'
  });
  const reservedTeacherScript = addMaterial(service, {
    classId: classroom.id,
    subjectId: subject.id,
    lessonId: null,
    title: 'Copione riservato UX2-C',
    role: 'support_material',
    type: 'teacher_script',
    contentText: 'Copione docente.'
  });
  const reservedLessonPlan = addMaterial(service, {
    classId: classroom.id,
    subjectId: subject.id,
    lessonId: lesson.id,
    title: 'Piano docente UX2-C',
    role: 'support_material',
    type: 'lesson_plan',
    contentText: 'Piano di lezione sintetico.'
  });
  const reservedAssessment = addMaterial(service, {
    classId: classroom.id,
    subjectId: subject.id,
    lessonId: lesson.id,
    title: 'Verifica riservata UX2-C',
    role: 'support_material',
    type: 'assessment',
    contentText: 'Domande e soluzioni riservate.'
  });
  // Keep the lesson pack complete so its confirmation path is exercised below.
  addMaterial(service, {
    classId: classroom.id,
    subjectId: subject.id,
    lessonId: lesson.id,
    title: 'Piano docente UX2-C',
    role: 'teacher_material',
    type: 'lesson_plan',
    contentText: 'Piano di lezione sintetico.'
  });
  addMaterial(service, {
    classId: classroom.id,
    subjectId: subject.id,
    lessonId: lesson.id,
    title: 'Copione docente UX2-C',
    role: 'teacher_material',
    type: 'teacher_script',
    contentText: 'Copione docente sintetico.'
  });

  const allowedOrigins = [];
  const app = await createHttpApp({
    service,
    teacherEmails: teacherEmail,
    allowedOrigins,
    authConfig: {
      webAud: 'teacher-service-publication-api-aud',
      expectedAud: 'teacher-service-publication-api-aud',
      allowSyntheticAuth: false
    }
  });
  let server;
  t.after(async () => {
    try { await app.close(); } catch {}
    try { dbManager.close(); } catch {}
    clearJwksCache();
    setTestAuthKeys(null);
    fs.rmSync(runRoot, { recursive: true, force: true });
  });

  try {
    server = await app.start(0, '127.0.0.1');
  } catch (error) {
    if (error?.code === 'EPERM') {
      t.skip('Loopback binding is unavailable in this environment; run the isolated publication API test with local networking enabled.');
      return;
    }
    throw error;
  }

  const baseUrl = server.url;
  allowedOrigins.push(baseUrl);
  const teacherCookie = `CF_Authorization=${tokens.get(teacherEmail)}`;
  const nonTeacherCookie = `CF_Authorization=${tokens.get(unauthorizedEmail)}`;
  const publicationPath = (materialId, versionNumber) => `/api/materials/${encodeURIComponent(materialId)}/versions/${versionNumber}/publication`;
  const teacherRequest = (method, url, { body, origin = true } = {}) => fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      cookie: teacherCookie,
      ...(origin ? { origin: baseUrl } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const studentRequest = (url) => fetch(`${baseUrl}${url}`);
  const readPublication = async (id, version) => {
    const response = await teacherRequest('GET', publicationPath(id, version));
    const payload = await response.json();
    return { response, publication: payload.publication };
  };
  const eventCount = (id, version) => Number(dbManager.prepare(`
    SELECT COUNT(*) AS count FROM material_publication_events
    WHERE resource_id = ? AND version_number = ?
  `).get(id, version).count);

  await t.test('GET requires a teacher principal and reports a never-published exact version', async () => {
    const anonymous = await fetch(`${baseUrl}${publicationPath(studentMaterial.id, 1)}`);
    assert.equal(anonymous.status, 401);
    const authenticatedNonTeacher = await fetch(`${baseUrl}${publicationPath(studentMaterial.id, 1)}`, {
      headers: { cookie: nonTeacherCookie }
    });
    assert.equal(authenticatedNonTeacher.status, 403);

    const { response, publication } = await readPublication(studentMaterial.id, 1);
    assert.equal(response.status, 200);
    assert.equal(publication.status, 'never_published');
    assert.equal(publication.isAvailable, false);
    assert.equal(publication.canPublish, true);
    assert.equal(publication.material.versionNumber, 1);
    assert.equal(Object.hasOwn(publication, 'actor'), false);
    assert.equal(Object.hasOwn(publication, 'notes'), false);
  });

  await t.test('exact versions are validated and missing material versions return 404', async () => {
    for (const version of ['0', '01', '1.0', 'not-a-version']) {
      const response = await teacherRequest('GET', publicationPath(studentMaterial.id, version));
      assert.equal(response.status, 400, `version ${version} should be rejected`);
    }
    assert.equal((await teacherRequest('GET', publicationPath(studentMaterial.id, 2))).status, 404);
    assert.equal((await teacherRequest('GET', publicationPath('missing-material', 1))).status, 404);
  });

  await t.test('CSRF guards both publication mutations before writing events', async () => {
    const publish = await teacherRequest('POST', publicationPath(studentMaterial.id, 1), {
      origin: false,
      body: { availableUntil: null }
    });
    const withdraw = await teacherRequest('DELETE', publicationPath(studentMaterial.id, 1), { origin: false });
    assert.equal(publish.status, 403);
    assert.equal(withdraw.status, 403);
    assert.equal(eventCount(studentMaterial.id, 1), 0);
    const preflight = await fetch(`${baseUrl}${publicationPath(studentMaterial.id, 1)}`, {
      method: 'OPTIONS',
      headers: { origin: baseUrl, 'access-control-request-method': 'DELETE' }
    });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('access-control-allow-methods') || '', /DELETE/);
  });

  await t.test('only eligible student-facing roles and resource types publish; preparation confirmation remains separate', async () => {
    for (const material of [teacherOnly, reservedTeacherScript, reservedLessonPlan, reservedAssessment]) {
      const response = await teacherRequest('POST', publicationPath(material.id, 1), { body: {} });
      assert.equal(response.status, 400, `${material.title} should be ineligible`);
      assert.equal(eventCount(material.id, 1), 0);
    }

    service.confirmLessonPreparation({ lessonId: lesson.id, notes: 'Conferma sintetica UX2-C', actorId: 'synthetic-confirmation-actor' });
    assert.equal(dbManager.prepare('SELECT COUNT(*) AS count FROM material_publication_events').get().count, 0);
  });

  await t.test('availableUntil rejects invalid and non-future values without writing publication events', async () => {
    const invalidValues = [
      'not-a-date',
      new Date(Date.now() - 60_000).toISOString(),
      42
    ];
    for (const availableUntil of invalidValues) {
      const response = await teacherRequest('POST', publicationPath(studentMaterial.id, 1), {
        body: { availableUntil }
      });
      assert.equal(response.status, 400);
      assert.equal(eventCount(studentMaterial.id, 1), 0);
    }
  });

  await t.test('publication derives the actor from the authenticated principal and duplicate requests do not append events', async () => {
    const forgedActor = await teacherRequest('POST', publicationPath(studentMaterial.id, 1), {
      body: { availableUntil: null, publishedBy: 'forged-client-identity' }
    });
    assert.equal(forgedActor.status, 400);
    assert.equal(eventCount(studentMaterial.id, 1), 0);

    const whoAmI = await teacherRequest('GET', '/api/auth/me');
    const expectedPrincipal = (await whoAmI.json()).principal;
    const first = await teacherRequest('POST', publicationPath(studentMaterial.id, 1), { body: { availableUntil: null } });
    assert.equal(first.status, 201);
    assert.equal((await first.json()).outcome, 'published');
    assert.equal(dbManager.prepare(`
      SELECT actor FROM material_publication_events WHERE resource_id = ? AND version_number = 1
    `).get(studentMaterial.id).actor, expectedPrincipal);

    const duplicate = await teacherRequest('POST', publicationPath(studentMaterial.id, 1), { body: { availableUntil: null } });
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).outcome, 'already_available');
    assert.equal(eventCount(studentMaterial.id, 1), 1);

    const published = await studentRequest(`/api/student/classes/${classroom.id}/materials`);
    assert.equal(published.status, 200);
    const listed = (await published.json()).materials;
    assert.ok(listed.some(item => item.id === studentMaterial.id && item.versionNumber === 1));
    assert.equal(listed.some(item => item.id === teacherOnly.id), false);

    const exactRead = await studentRequest(`/api/student/classes/${classroom.id}/materials/${studentMaterial.id}/versions/1`);
    assert.equal(exactRead.status, 200);
    const studentContent = (await exactRead.json()).material.content;
    assert.match(studentContent, /Contenuto disponibile agli studenti/);
    assert.doesNotMatch(studentContent, /risposta riservata|TEACHER_ONLY_SOLUTION/);
  });

  await t.test('versions publish independently; older available versions remain visible and can be withdrawn alone', async () => {
    const supportV1 = await teacherRequest('POST', publicationPath(supportMaterial.id, 1), { body: {} });
    assert.equal(supportV1.status, 201);
    service.updateMaterial(supportMaterial.id, {
      contentText: 'Esercizio di supporto versione 2.',
      changeSummary: 'Seconda versione sintetica',
      updatedBy: 'synthetic-teacher'
    });
    const v2BeforePublish = await readPublication(supportMaterial.id, 2);
    assert.equal(v2BeforePublish.publication.status, 'never_published');
    assert.equal(v2BeforePublish.publication.otherAvailableVersions.length, 1);
    assert.equal(v2BeforePublish.publication.otherAvailableVersions[0].versionNumber, 1);

    const supportV2 = await teacherRequest('POST', publicationPath(supportMaterial.id, 2), { body: {} });
    assert.equal(supportV2.status, 201);
    assert.equal(eventCount(supportMaterial.id, 1), 1);
    assert.equal(eventCount(supportMaterial.id, 2), 1);

    const withdrawV1 = await teacherRequest('DELETE', publicationPath(supportMaterial.id, 1));
    assert.equal(withdrawV1.status, 200);
    assert.equal((await withdrawV1.json()).outcome, 'withdrawn');
    const v1Status = await readPublication(supportMaterial.id, 1);
    assert.equal(v1Status.publication.status, 'withdrawn');
    const v2Status = await readPublication(supportMaterial.id, 2);
    assert.equal(v2Status.publication.status, 'available');
    assert.equal(v2Status.publication.otherAvailableVersions.length, 0);

    const duplicateWithdrawal = await teacherRequest('DELETE', publicationPath(supportMaterial.id, 1));
    assert.equal(duplicateWithdrawal.status, 200);
    assert.equal((await duplicateWithdrawal.json()).outcome, 'already_withdrawn');
    assert.equal(eventCount(supportMaterial.id, 1), 2);

    const studentListResponse = await studentRequest(`/api/student/classes/${classroom.id}/materials`);
    const studentList = (await studentListResponse.json()).materials;
    const availableSupportVersions = studentList.filter(item => item.id === supportMaterial.id).map(item => item.versionNumber);
    assert.deepEqual(availableSupportVersions, [2]);
  });

  await t.test('expired publications become unavailable to students without rewriting their history', async () => {
    const expiryDate = new Date(Date.now() + 1200).toISOString();
    const response = await teacherRequest('POST', publicationPath(studentMaterial.id, 1), {
      body: { availableUntil: expiryDate }
    });
    assert.equal(response.status, 201);
    const countBeforeExpiry = eventCount(studentMaterial.id, 1);
    await sleep(1350);

    const status = await readPublication(studentMaterial.id, 1);
    assert.equal(status.publication.status, 'expired');
    assert.equal(status.publication.canUnpublish, false);
    assert.equal(eventCount(studentMaterial.id, 1), countBeforeExpiry);
    const studentList = await studentRequest(`/api/student/classes/${classroom.id}/materials`).then(response => response.json());
    assert.equal(studentList.materials.some(item => item.id === studentMaterial.id && item.versionNumber === 1), false);
  });

  await t.test('student file access follows the exact published version and stops at withdrawal', async () => {
    const filePath = `/api/student/classes/${classroom.id}/materials/${supportMaterial.id}/versions/2/download`;
    const before = await studentRequest(filePath);
    assert.equal(before.status, 200);
    assert.match(before.headers.get('content-disposition') || '', /^attachment;/);
    assert.match(await before.text(), /Esercizio di supporto versione 2/);

    const withdrawn = await teacherRequest('DELETE', publicationPath(supportMaterial.id, 2));
    assert.equal(withdrawn.status, 200);
    assert.equal((await studentRequest(filePath)).status, 404);

    const studentList = await studentRequest(`/api/student/classes/${classroom.id}/materials`).then(response => response.json());
    assert.equal(studentList.materials.some(item => item.id === supportMaterial.id), false);
  });

  await t.test('archiving a material makes its published version unavailable without deleting history', async () => {
    const archivable = addMaterial(service, {
      classId: classroom.id,
      subjectId: subject.id,
      lessonId: lesson.id,
      title: 'Dispensa archiviabile UX2-C',
      role: 'student_material',
      type: 'custom',
      contentText: 'Contenuto sintetico prima dell’archiviazione.'
    });
    assert.equal((await teacherRequest('POST', publicationPath(archivable.id, 1), { body: {} })).status, 201);
    const studentListBefore = await studentRequest(`/api/student/classes/${classroom.id}/materials`).then(response => response.json());
    assert.equal(studentListBefore.materials.some(item => item.id === archivable.id), true);

    service.deleteMaterial(archivable.id);
    const status = await readPublication(archivable.id, 1);
    assert.equal(status.publication.status, 'unavailable');
    assert.equal(status.publication.blockedReason, 'material_inactive');
    assert.equal(status.publication.canPublish, false);
    assert.equal(status.publication.canUnpublish, false);
    assert.equal(status.publication.otherAvailableVersions.length, 0);
    assert.equal(eventCount(archivable.id, 1), 1);

    const studentListAfter = await studentRequest(`/api/student/classes/${classroom.id}/materials`).then(response => response.json());
    assert.equal(studentListAfter.materials.some(item => item.id === archivable.id), false);
    assert.equal((await studentRequest(`/api/student/classes/${classroom.id}/materials/${archivable.id}/versions/1`)).status, 404);
    assert.equal((await teacherRequest('POST', publicationPath(archivable.id, 1), { body: {} })).status, 400);
    assert.equal((await teacherRequest('DELETE', publicationPath(archivable.id, 1))).status, 409);
  });

  await t.test('withdrawal from an expired or never-published version is a state conflict', async () => {
    const neverPublished = await teacherRequest('DELETE', publicationPath(teacherOnly.id, 1));
    assert.equal(neverPublished.status, 409);
    const expired = await teacherRequest('DELETE', publicationPath(studentMaterial.id, 1));
    assert.equal(expired.status, 409);
  });
});
