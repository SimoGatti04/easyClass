import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';
import { createStoreSnapshot, restoreStoreSnapshot, verifyStoreSnapshot, verifyStorePair } from '../../src/storage/store-snapshot.js';

test('R3 SQLite + FileStore recovery and rollback drill', async (t) => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'drill-r3-recovery-'));
  const originalDir = path.join(tmpRoot, 'original');
  const snapshotPreDir = path.join(tmpRoot, 'snapshot-pre-cutover');
  const restoredTargetDir = path.join(tmpRoot, 'restored-isolated');
  fs.mkdirSync(originalDir, { recursive: true });

  const dbPath = path.join(originalDir, 'teacher_service.db');
  const filesPath = path.join(originalDir, 'files');
  fs.mkdirSync(filesPath, { recursive: true });

  const PIN_SECRET = 'synthetic-r3-drill-secret-must-be-at-least-32-chars-long!';

  // 1. Simulate T1 baseline schema and data
  const t1Db = new DatabaseSync(dbPath);
  t1Db.exec(`
    CREATE TABLE classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      section TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE subjects (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id),
      name TEXT NOT NULL,
      code TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE lessons (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id),
      subject_id TEXT NOT NULL REFERENCES subjects(id),
      title TEXT NOT NULL,
      description TEXT,
      date TEXT,
      order_index INTEGER DEFAULT 0,
      status TEXT DEFAULT 'planned',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE materials (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      lesson_id TEXT REFERENCES lessons(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO classes (id, name, academic_year, section, description, created_at, updated_at)
    VALUES ('cls-r3-1', '5A Informatica', '2026/2027', 'A', 'Classe T1 esistente', '2026-10-15T08:00:00Z', '2026-10-15T08:00:00Z');
    INSERT INTO subjects (id, class_id, name, code, description, created_at, updated_at)
    VALUES ('sub-r3-1', 'cls-r3-1', 'Sistemi e Reti', 'SR5', 'Materia T1', '2026-10-15T08:00:00Z', '2026-10-15T08:00:00Z');
    INSERT INTO lessons (id, class_id, subject_id, title, description, date, order_index, status, created_at, updated_at)
    VALUES ('les-r3-1', 'cls-r3-1', 'sub-r3-1', 'Routing e Access Control', 'Lezione T1', '2026-10-16', 1, 'planned', '2026-10-15T08:00:00Z', '2026-10-15T08:00:00Z');
  `);
  t1Db.close();

  // Create pre-cutover snapshot (representing maintenance window start)
  const preSnapshot = createStoreSnapshot({
    databasePath: dbPath,
    fileStorePath: filesPath,
    snapshotPath: snapshotPreDir
  });
  assert.ok(preSnapshot.snapshotPath, 'Pre-cutover snapshot created');
  const verifyPre = verifyStoreSnapshot(snapshotPreDir);
  assert.equal(verifyPre.integrity, 'ok');

  // Step 1: Forward migration to R3 schema
  const dbManager = new DatabaseManager(dbPath).init();
  const fileStore = new FileStore(filesPath);
  let service = new TeacherService({
    dbManager,
    fileStore,
    mockAi: true,
    classPinSecret: PIN_SECRET
  });

  // Verify R3 tables exist
  const pinsTable = dbManager.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='class_activity_pins'").get();
  assert.ok(pinsTable, 'class_activity_pins table created');
  const classSessionsTable = dbManager.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='student_class_sessions'").get();
  assert.ok(classSessionsTable, 'student_class_sessions table created');
  const attemptSessionsTable = dbManager.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='student_attempt_sessions'").get();
  assert.ok(attemptSessionsTable, 'student_attempt_sessions table created');

  // Step 2: Create assessment and PIN, start attempt
  const student = service.addStudent({
    classId: 'cls-r3-1',
    firstName: 'Ada',
    lastName: 'Lovelace'
  });

  const studentMaterial = service.createMaterial({
    title: 'Dispensa Reti TCP/IP',
    contentText: '# Reti di Calcolatori\nIl protocollo TCP opera a livello di trasporto...',
    pedagogicalRole: 'student_material',
    classId: 'cls-r3-1',
    subjectId: 'sub-r3-1'
  });
  service.publishMaterial(studentMaterial.id, { versionNumber: 1 });

  const assessment = service.createAssessment({
    title: 'Verifica Reti R3',
    description: 'Verifica svolta con portale R3',
    classId: 'cls-r3-1',
    subjectId: 'sub-r3-1',
    status: 'active',
    durationMinutes: 60,
    maxScore: 30,
    items: [
      {
        type: 'open_short',
        questionText: 'Cosa si intende per Zero Trust?',
        maxScore: 10,
        assessableSourceId: studentMaterial.id,
        assessableSourceVersion: 1,
        teacherSolution: 'Soluzione riservata docente'
      },
      {
        type: 'open_short',
        questionText: 'Descrivi la differenza tra TCP e UDP',
        maxScore: 10,
        assessableSourceId: studentMaterial.id,
        assessableSourceVersion: 1,
        teacherSolution: 'TCP affidabile, UDP veloce'
      },
      {
        type: 'attachment',
        questionText: 'Allega il diagramma di rete',
        maxScore: 10,
        assessableSourceId: studentMaterial.id,
        assessableSourceVersion: 1,
        teacherSolution: 'Diagramma di rete allegato'
      }
    ]
  });

  const pinGen1 = service.generateClassActivityPin('cls-r3-1', { createdBy: 'prof-test' });
  const pin1 = pinGen1.pin;
  assert.match(pin1, /^\d{4}$/, '4-digit PIN generated');

  // Redeem PIN to get class access session
  const classSession = service.redeemClassActivityPin('cls-r3-1', pin1);
  assert.ok(classSession.token, 'Class session token issued');

  const validatedSession1 = service.validateClassActivitySession(classSession.token, 'cls-r3-1');
  // Start attempt for Ada Lovelace
  const attemptStart = service.startClassAttempt({
    classId: 'cls-r3-1',
    assessmentId: assessment.id,
    studentId: student.id,
    seatRow: 'Fila 1',
    seatDesk: 'Banco 2',
    leftNeighborId: 'none',
    rightNeighborId: 'none',
    classSessionId: validatedSession1.id
  });
  assert.equal(attemptStart.resumed, false);
  assert.ok(attemptStart.token, 'Attempt bearer token issued');
  const submissionId = attemptStart.submission.id;
  const initialExpiry = attemptStart.submission.timer.expires_at;

  // Step 3: Save draft responses and student attachment
  service.saveDraftSubmission({
    assessmentId: assessment.id,
    submissionId,
    responses: [
      { itemId: assessment.items[0].id, responseText: 'Zero Trust richiede continua verifica dell identita.' }
    ],
    timeSpentSeconds: 120,
    studentId: student.id
  });

  const attachmentPayload = Buffer.from('Contenuto schema di rete allegato da Ada Lovelace', 'utf8');
  const attachmentResult = service.registerStudentAttachment({
    assessmentId: assessment.id,
    studentId: student.id,
    itemId: assessment.items[2].id,
    filename: 'schema-rete.txt',
    contentType: 'text/plain',
    buffer: attachmentPayload
  });
  assert.ok(attachmentResult.attachmentId, 'Attachment registered');

  // Step 4: Rotate / revoke PIN
  const pinGen2 = service.generateClassActivityPin('cls-r3-1', { createdBy: 'prof-test' });
  const pin2 = pinGen2.pin;
  assert.notEqual(pin1, pin2, 'PIN rotated');

  // Old PIN is rejected
  assert.throws(() => {
    service.redeemClassActivityPin('cls-r3-1', pin1);
  }, /non valido/, 'Old revoked PIN is rejected');

  // Step 5: Preserve already-started attempts
  // Existing attempt can continue to save responses despite PIN rotation
  service.saveDraftSubmission({
    assessmentId: assessment.id,
    submissionId,
    responses: [
      { itemId: assessment.items[0].id, responseText: 'Zero Trust richiede continua verifica dell identita (aggiornato).' },
      { itemId: assessment.items[1].id, responseText: 'TCP stabilisce connessione 3-way handshake; UDP e connectionless.' },
      { itemId: assessment.items[2].id, responseText: 'Vedi schema allegato.', attachmentId: attachmentResult.attachmentId }
    ],
    timeSpentSeconds: 240,
    studentId: student.id
  });

  const submissionDuringActive = service.getStudentSubmission(assessment.id, student.id);
  assert.equal(submissionDuringActive.responses.length, 3);
  const attResp = submissionDuringActive.responses.find(r => r.has_attachment);
  assert.ok(attResp, "Attachment response present");
  assert.equal(attResp.attachment_name, "schema-rete.txt");
  assert.equal(submissionDuringActive.timer.expires_at, initialExpiry);

  // Close service before simulating downgrade
  service.close();

  // Step 6: Simulate downgrade to legacy T1 image
  // T1 opens SQLite with standard T1 queries
  const legacyT1Db = new DatabaseSync(dbPath);
  const classesQuery = legacyT1Db.prepare('SELECT id, name FROM classes WHERE id = ?').get('cls-r3-1');
  assert.equal(classesQuery.name, '5A Informatica');

  const lessonsQuery = legacyT1Db.prepare('SELECT id, title FROM lessons WHERE id = ?').get('les-r3-1');
  assert.equal(lessonsQuery.title, 'Routing e Access Control');

  // Step 7: Verify that no data is corrupted or deleted
  const submissionsRaw = legacyT1Db.prepare('SELECT count(*) as cnt FROM assessment_submissions').get();
  assert.equal(submissionsRaw.cnt, 1, 'Submission preserved');
  const attachmentsRaw = legacyT1Db.prepare('SELECT count(*) as cnt FROM student_attachments').get();
  assert.equal(attachmentsRaw.cnt, 1, 'Attachment row preserved');
  const pinsRaw = legacyT1Db.prepare('SELECT count(*) as cnt FROM class_activity_pins').get();
  assert.equal(pinsRaw.cnt, 2, 'PIN history preserved');

  // T1 image lacks R3 portal routes and PIN handlers:
  // Under T1 runtime, students CANNOT redeem class PIN or access /api/student/classes/:id/access
  // because the legacy T1 server binary does not implement shared class PIN or portal routes.
  legacyT1Db.close();

  // Step 8: Return to R3 compatible version and recover verification
  const dbManagerRecovered = new DatabaseManager(dbPath).init();
  const fileStoreRecovered = new FileStore(filesPath);
  const serviceRecovered = new TeacherService({
    dbManager: dbManagerRecovered,
    fileStore: fileStoreRecovered,
    mockAi: true,
    classPinSecret: PIN_SECRET
  });

  // Re-enter with new PIN
  const classSessionNew = serviceRecovered.redeemClassActivityPin('cls-r3-1', pin2);
  assert.ok(classSessionNew.token);

  const validatedSession2 = serviceRecovered.validateClassActivitySession(classSessionNew.token, 'cls-r3-1');
  // Resume attempt for Ada Lovelace
  const attemptResume = serviceRecovered.startClassAttempt({
    classId: 'cls-r3-1',
    assessmentId: assessment.id,
    studentId: student.id,
    seatRow: 'Fila 1',
    seatDesk: 'Banco 2',
    leftNeighborId: 'none',
    rightNeighborId: 'none',
    classSessionId: validatedSession2.id
  });
  assert.equal(attemptResume.resumed, true, 'Existing attempt resumed');
  assert.equal(attemptResume.submission.id, submissionId, 'Same submission ID recovered');
  assert.equal(attemptResume.submission.timer.expires_at, initialExpiry, 'Timer expiry unchanged');
  assert.equal(attemptResume.submission.responses.length, 3, 'All 3 responses preserved');
  const resumeAtt = attemptResume.submission.responses.find(r => r.has_attachment);
  assert.ok(resumeAtt, 'Attachment preserved in resumed attempt');
  assert.equal(resumeAtt.attachment_name, 'schema-rete.txt');

  // Verify attachment file content on disk is intact
  const attData = serviceRecovered.getStudentAttachment({
    assessmentId: assessment.id,
    studentId: student.id,
    attachmentId: resumeAtt.attachment_id
  });
  assert.equal(attData.original_name, 'schema-rete.txt');
  const storedBytes = fileStoreRecovered.readStoredFile(attData.storage_path);
  assert.equal(storedBytes.buffer.toString('utf8'), 'Contenuto schema di rete allegato da Ada Lovelace');

  // Verify post-cutover store integrity with verifyStorePair
  const pairCheck = verifyStorePair({ databasePath: dbPath, fileStorePath: filesPath });
  assert.equal(pairCheck.integrity, 'ok');
  assert.equal(pairCheck.foreignKeyViolations, 0);

  serviceRecovered.close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
