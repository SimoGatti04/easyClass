import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DatabaseManager } from '../../src/db/database.js';
import { createStoreSnapshot, restoreStoreSnapshot, verifyStoreSnapshot } from '../../src/storage/store-snapshot.js';

test('T1 -> C6 migration and rollback drill on synthetic isolated store', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'drill-t1-c6-'));
  const originalDir = path.join(tmpRoot, 'original');
  const snapshotDir = path.join(tmpRoot, 'snapshot-pre-migration');
  const restoredTargetDir = path.join(tmpRoot, 'restored-isolated');
  fs.mkdirSync(originalDir, { recursive: true });

  const dbPath = path.join(originalDir, 'teacher_service.db');
  const filesPath = path.join(originalDir, 'files');
  fs.mkdirSync(filesPath, { recursive: true });
  fs.writeFileSync(path.join(filesPath, 'sample_attachment.txt'), 'Sample synthetic attachment content', 'utf8');

  // 1. Simulate T1 schema and baseline data
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
      status TEXT NOT NULL DEFAULT 'planned',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO classes (id, name, academic_year, section, description, created_at, updated_at)
    VALUES ('cls-drill-1', '5B Informatica', '2026/2027', 'B', 'Classe T1 drill', '2026-10-15T08:00:00Z', '2026-10-15T08:00:00Z');
    INSERT INTO subjects (id, class_id, name, code, description, created_at, updated_at)
    VALUES ('sub-drill-1', 'cls-drill-1', 'Sistemi e Reti', 'SR', 'Materia T1 drill', '2026-10-15T08:00:00Z', '2026-10-15T08:00:00Z');
    INSERT INTO lessons (id, class_id, subject_id, title, description, date, order_index, status, created_at, updated_at)
    VALUES ('les-drill-1', 'cls-drill-1', 'sub-drill-1', 'Crittografia e Zero Trust', 'Lezione T1', '2026-10-16', 1, 'planned', '2026-10-15T08:00:00Z', '2026-10-15T08:00:00Z');
  `);
  t1Db.close();

  // 2. Pre-migration snapshot (procedure step 2)
  const snapResult = createStoreSnapshot({
    databasePath: dbPath,
    fileStorePath: filesPath,
    snapshotPath: snapshotDir
  });
  assert.ok(snapResult.snapshotPath, 'Snapshot created');
  const verifyResult = verifyStoreSnapshot(snapshotDir);
  assert.equal(verifyResult.integrity, 'ok');
  assert.equal(verifyResult.foreignKeyViolations, 0);
  assert.equal(verifyResult.fileCount, 1);

  // 3. Apply C6 additive migration (procedure step 3)
  const dbManager = new DatabaseManager(dbPath);
  dbManager.init(); // runs migrations
  
  // Verify C6 tables exist
  const assessTable = dbManager.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='assessments'").get();
  assert.ok(assessTable, 'C6 assessments table created');
  const credsTable = dbManager.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='student_activity_credentials'").get();
  assert.ok(credsTable, 'C6 student_activity_credentials table created');
  const integrityTable = dbManager.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='integrity_review_events'").get();
  assert.ok(integrityTable, 'C6 integrity_review_events table created');

  // Verify T1 data preserved
  const lesson = dbManager.prepare('SELECT * FROM lessons WHERE id = ?').get('les-drill-1');
  assert.equal(lesson.title, 'Crittografia e Zero Trust');
  assert.equal(lesson.duration_minutes, 60); // additive column default
  dbManager.close();

  // 4. Test recovery procedure: rollback to pre-migration state into new target directory
  const restoredDbPath = path.join(restoredTargetDir, 'database.sqlite');
  const restoredFilesPath = path.join(restoredTargetDir, 'files');
  const restoreResult = restoreStoreSnapshot({
    snapshotPath: snapshotDir,
    databasePath: restoredDbPath,
    fileStorePath: restoredFilesPath
  });
  assert.equal(restoreResult.fileCount, 1);

  // Verify restored database is exactly at pre-migration T1 state
  const restoredDb = new DatabaseSync(restoredDbPath);
  const restoredAssessTable = restoredDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='assessments'").get();
  assert.equal(restoredAssessTable, undefined, 'Restored database does NOT have C6 tables');
  const restoredLesson = restoredDb.prepare('SELECT * FROM lessons WHERE id = ?').get('les-drill-1');
  assert.equal(restoredLesson.title, 'Crittografia e Zero Trust');
  assert.equal(restoredLesson.duration_minutes, undefined, 'Restored database does NOT have duration_minutes column');
  restoredDb.close();

  // Verify restored files
  assert.equal(fs.readFileSync(path.join(restoredFilesPath, 'sample_attachment.txt'), 'utf8'), 'Sample synthetic attachment content');


  // 5. Test T1 runtime compatibility on both restored store and post-migration store
  // 5a. Post-migration store: T1 baseline queries succeed (additive migration preserves T1 reads)
  const postMigrationDb = new DatabaseSync(dbPath);
  const t1LessonsPostMig = postMigrationDb.prepare("SELECT id, title, description, class_id, subject_id FROM lessons WHERE id = ?").get("les-drill-1");
  assert.equal(t1LessonsPostMig.title, "Crittografia e Zero Trust");
  postMigrationDb.close();

  // 5b. Restored target store: T1 baseline queries succeed in full pristine T1 state
  const restoredDbCheck = new DatabaseSync(restoredDbPath);
  const t1LessonsRestored = restoredDbCheck.prepare("SELECT id, title, description, class_id, subject_id FROM lessons WHERE id = ?").get("les-drill-1");
  assert.equal(t1LessonsRestored.title, "Crittografia e Zero Trust");
  restoredDbCheck.close();

  // Cleanup
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
