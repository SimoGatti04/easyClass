import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';
import { verifyStorePair } from '../../src/storage/store-snapshot.js';

test('Real T1 container downgrade and recovery drill against migrated R3 store', async (t) => {
  const T1_IMAGE = 'ghcr.io/simogatti04/class:20261020-f962706';

  let hasDockerAndImage = false;
  try {
    const imagesOutput = execSync(`docker images -q "${T1_IMAGE}"`, { stdio: 'pipe' }).toString().trim();
    if (imagesOutput.length > 0) {
      hasDockerAndImage = true;
    }
  } catch {
    hasDockerAndImage = false;
  }

  if (!hasDockerAndImage) {
    t.skip(`Docker daemon or image ${T1_IMAGE} not accessible in current execution environment`);
    return;
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'drill-t1-real-container-'));
  const dbDir = path.join(tmpRoot, 'db');
  const filesDir = path.join(tmpRoot, 'files');
  fs.mkdirSync(dbDir, { recursive: true });
  fs.mkdirSync(filesDir, { recursive: true });
  fs.chmodSync(tmpRoot, 0o777);
  fs.chmodSync(dbDir, 0o777);
  fs.chmodSync(filesDir, 0o777);

  const dbPath = path.join(dbDir, 'teacher_service.db');
  const PIN_SECRET = 'synthetic-r3-real-t1-test-secret-at-least-32-chars-ok!';

  // STEP 1: Initialize R3 Store using TeacherService R3
  const dbManagerR3 = new DatabaseManager(dbPath).init();
  const fileStoreR3 = new FileStore(filesDir);
  const serviceR3 = new TeacherService({
    dbManager: dbManagerR3,
    fileStore: fileStoreR3,
    mockAi: true,
    classPinSecret: PIN_SECRET
  });

  const cls = serviceR3.createClass({
    name: '5B Informatica',
    academicYear: '2026/2027',
    section: 'B'
  });

  const sub = serviceR3.createSubject({
    classId: cls.id,
    name: 'Sistemi e Reti',
    code: 'SR5'
  });

  const lesson = serviceR3.createLesson({
    classId: cls.id,
    subjectId: sub.id,
    title: 'Sicurezza e Zero Trust',
    date: '2026-10-26'
  });

  const studentMat = serviceR3.createMaterial({
    classId: cls.id,
    subjectId: sub.id,
    lessonId: lesson.id,
    title: 'Dispensa Crittografia R3',
    contentText: '# Crittografia e PIN\nContenuto didattico pubblico.',
    pedagogicalRole: 'student_material'
  });
  serviceR3.publishMaterial(studentMat.id, { versionNumber: 1 });

  const student = serviceR3.addStudent({
    classId: cls.id,
    firstName: 'Alan',
    lastName: 'Turing'
  });

  const assessment = serviceR3.createAssessment({
    title: 'Verifica Reti R3 - T1 Downgrade Test',
    description: 'Verifica per test container reale',
    classId: cls.id,
    subjectId: sub.id,
    status: 'active',
    durationMinutes: 45,
    maxScore: 30,
    items: [
      {
        type: 'open_short',
        questionText: 'Definisci il concetto di Fail-Closed',
        maxScore: 15,
        assessableSourceId: studentMat.id,
        assessableSourceVersion: 1,
        teacherSolution: 'Soluzione docente'
      },
      {
        type: 'attachment',
        questionText: 'Allega il file di configurazione',
        maxScore: 15,
        assessableSourceId: studentMat.id,
        assessableSourceVersion: 1,
        teacherSolution: 'Configurazione'
      }
    ]
  });

  // Generate PIN and start attempt in R3
  const pinGen1 = serviceR3.generateClassActivityPin(cls.id, { createdBy: 'prof@scuola.test' });
  const pin1 = pinGen1.pin;
  const classSession = serviceR3.redeemClassActivityPin(cls.id, pin1);
  const validatedSession = serviceR3.validateClassActivitySession(classSession.token, cls.id);

  const attempt = serviceR3.startClassAttempt({
    classId: cls.id,
    assessmentId: assessment.id,
    studentId: student.id,
    seatRow: 'Fila 1',
    seatDesk: 'Banco 1',
    leftNeighborId: 'none',
    rightNeighborId: 'none',
    classSessionId: validatedSession.id
  });

  const submissionId = attempt.submission.id;
  const initialExpiry = attempt.submission.timer.expires_at;

  const attachmentBuffer = Buffer.from('CONTENUTO_ALLEGATO_R3_TEST_REALE', 'utf-8');
  const attachmentResult = serviceR3.registerStudentAttachment({
    assessmentId: assessment.id,
    studentId: student.id,
    itemId: assessment.items[1].id,
    filename: 'config-r3.conf',
    contentType: 'text/plain',
    buffer: attachmentBuffer
  });

  // Save answer and attachment in R3
  serviceR3.saveDraftSubmission({
    assessmentId: assessment.id,
    submissionId,
    responses: [
      { itemId: assessment.items[0].id, responseText: 'Fail-closed blocca ogni accesso per default in caso di anomalia.' },
      { itemId: assessment.items[1].id, responseText: 'Vedi file allegato.', attachmentId: attachmentResult.attachmentId }
    ],
    timeSpentSeconds: 60,
    studentId: student.id
  });

  // Close R3 service before starting T1 container
  serviceR3.close();
  // Ensure permissions on DB file for node user inside container
  fs.chmodSync(dbPath, 0o666);

  // STEP 2: Boot real T1 container on isolated port
  const PORT = 8793;
  const containerName = `t1-real-drill-${Date.now()}`;

  const dockerArgs = [
    'run', '--rm', '-d',
    '--name', containerName,
    '-p', `127.0.0.1:${PORT}:80`,
    '-v', `${dbDir}:/app/storage/db`,
    '-v', `${filesDir}:/app/storage/files`,
    '-e', 'PORT=80',
    '-e', 'HOST=0.0.0.0',
    '-e', 'NODE_ENV=production',
    '-e', 'TEACHER_SERVICE_AUTH_MODE=strict',
    '-e', 'TEACHER_SERVICE_WEB_CF_ACCESS_AUD=t1-audit-test-aud',
    '-e', 'TEACHER_SERVICE_TEACHER_EMAILS=prof@scuola.test',
    T1_IMAGE
  ];

  execSync(`docker ${dockerArgs.join(' ')}`);

  function stopContainer() {
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
    } catch {}
  }

  try {
    let healthy = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/health`);
        if (res.status === 200) {
          const body = await res.json();
          if (body.status === 'ok') {
            healthy = true;
            break;
          }
        }
      } catch {}
    }
    assert.equal(healthy, true, 'T1 container must become healthy within 10s');

    // STEP 3: Verify T1 behavior against migrated R3 store
    // 3a. Health & SPA shell
    const healthRes = await fetch(`http://127.0.0.1:${PORT}/health`);
    assert.equal(healthRes.status, 200);

    const rootRes = await fetch(`http://127.0.0.1:${PORT}/`);
    assert.equal(rootRes.status, 200);
    const rootText = await rootRes.text();
    assert.ok(rootText.includes('html'));

    // 3b. Verify fail-closed teacher auth
    const teacherApiRes = await fetch(`http://127.0.0.1:${PORT}/api/classes`);
    assert.ok([401, 403].includes(teacherApiRes.status), 'Teacher API must be fail-closed in T1');

    // 3c. Verify student routes in T1 fail-closed (in T1 /api/student/* requires auth / returns 401/403/404)
    const studentClassesRes = await fetch(`http://127.0.0.1:${PORT}/api/student/classes`);
    assert.ok([401, 403, 404].includes(studentClassesRes.status), 'Student classes route in T1 fails closed');

    const pinAccessRes = await fetch(`http://127.0.0.1:${PORT}/api/student/classes/${cls.id}/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' })
    });
    assert.ok([401, 403, 404].includes(pinAccessRes.status), 'PIN access route in T1 fails closed');

    // Stop T1 container
    stopContainer();

    // STEP 4: Restart R3 service against the same store and verify data integrity
    const dbManagerR3After = new DatabaseManager(dbPath).init();
    const fileStoreR3After = new FileStore(filesDir);
    const serviceR3After = new TeacherService({
      dbManager: dbManagerR3After,
      fileStore: fileStoreR3After,
      mockAi: true,
      classPinSecret: PIN_SECRET
    });

    // Verify class, subject, lesson, materials are intact
    const classes = serviceR3After.listClasses();
    assert.equal(classes.length, 1);
    assert.equal(classes[0].id, cls.id);

    // Verify materials and versions
    const materials = serviceR3After.listMaterials({ classId: cls.id });
    assert.equal(materials.length, 1);
    assert.equal(materials[0].id, studentMat.id);

    // Verify R3 attempt, answers, and attachment recovery
    const classSessionAfter = serviceR3After.redeemClassActivityPin(cls.id, pin1);
    const validatedSessionAfter = serviceR3After.validateClassActivitySession(classSessionAfter.token, cls.id);

    const resumedAttempt = serviceR3After.startClassAttempt({
      classId: cls.id,
      assessmentId: assessment.id,
      studentId: student.id,
      seatRow: 'Fila 1',
      seatDesk: 'Banco 1',
      leftNeighborId: 'none',
      rightNeighborId: 'none',
      classSessionId: validatedSessionAfter.id
    });

    assert.equal(resumedAttempt.resumed, true);
    assert.equal(resumedAttempt.submission.id, submissionId);
    assert.equal(resumedAttempt.submission.timer.expires_at, initialExpiry);
    assert.equal(resumedAttempt.submission.responses.length, 2);

    const resp0 = resumedAttempt.submission.responses.find(r => r.item_id === assessment.items[0].id);
    assert.ok(resp0);
    assert.equal(resp0.response_text, 'Fail-closed blocca ogni accesso per default in caso di anomalia.');

    const resp1 = resumedAttempt.submission.responses.find(r => r.item_id === assessment.items[1].id);
    assert.ok(resp1);
    assert.equal(resp1.has_attachment, true);
    assert.equal(resp1.attachment_name, 'config-r3.conf');

    // Verify attachment in FileStore
    const attData = serviceR3After.getStudentAttachment({
      assessmentId: assessment.id,
      studentId: student.id,
      attachmentId: resp1.attachment_id
    });
    assert.ok(attData);
    assert.equal(attData.original_name, 'config-r3.conf');
    const storedBytes = fileStoreR3After.readStoredFile(attData.storage_path);
    assert.equal(storedBytes.buffer.toString('utf-8'), 'CONTENUTO_ALLEGATO_R3_TEST_REALE');

    // Verify store pair consistency
    const pairCheck = verifyStorePair({ databasePath: dbPath, fileStorePath: filesDir });
    assert.equal(pairCheck.integrity, 'ok');
    assert.equal(pairCheck.foreignKeyViolations, 0);

    serviceR3After.close();
  } finally {
    stopContainer();
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  }
});
