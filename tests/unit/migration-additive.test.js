import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseManager } from '../../src/db/database.js';

test('Database additive migration preserves existing legacy data and extends schema', (t) => {
  const tmpDir = path.resolve(process.cwd(), '.tmp', `migration-test-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  const dbPath = path.join(tmpDir, 'legacy_teacher.db');

  // Step 1: Create a legacy database without duration_minutes and without lesson_preparation_confirmations
  const legacyDb = new DatabaseSync(dbPath);
  legacyDb.exec(`
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
    VALUES ('cls-legacy-1', '3A Informatica', '2025/2026', 'A', 'Classe preesistente', '2025-09-10T08:00:00Z', '2025-09-10T08:00:00Z');

    INSERT INTO subjects (id, class_id, name, code, description, created_at, updated_at)
    VALUES ('sub-legacy-1', 'cls-legacy-1', 'Informatica Generale', 'INF', 'Materia preesistente', '2025-09-10T08:00:00Z', '2025-09-10T08:00:00Z');

    INSERT INTO lessons (id, class_id, subject_id, title, description, date, order_index, status, created_at, updated_at)
    VALUES ('les-legacy-1', 'cls-legacy-1', 'sub-legacy-1', 'Algoritmi e Flowchart', 'Prima lezione dell anno', '2025-09-15', 1, 'completed', '2025-09-10T08:00:00Z', '2025-09-10T08:00:00Z');
  `);
  legacyDb.close();

  // Step 2: Initialize DatabaseManager against this existing legacy DB
  const dbManager = new DatabaseManager(dbPath);
  dbManager.init();

  // Step 3: Verify additive migration results
  // A. Existing data preserved
  const lesson = dbManager.prepare('SELECT * FROM lessons WHERE id = ?').get('les-legacy-1');
  assert.ok(lesson, 'Legacy lesson record must still exist');
  assert.equal(lesson.title, 'Algoritmi e Flowchart');
  assert.equal(lesson.status, 'completed');

  // B. Added duration_minutes column with default
  assert.equal(lesson.duration_minutes, 60, 'duration_minutes must default to 60');

  // C. New table lesson_preparation_confirmations exists and is operational
  const tableCheck = dbManager.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='lesson_preparation_confirmations'"
  ).get();
  assert.ok(tableCheck, 'lesson_preparation_confirmations table must exist after migration');

  // D. Can insert into lesson_preparation_confirmations
  dbManager.prepare(`
    INSERT INTO lesson_preparation_confirmations (id, lesson_id, confirmed_at, confirmed_by, notes, artifact_versions_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('lpc-1', 'les-legacy-1', '2026-10-19T10:00:00Z', 'prof.rossi', 'Conferma test', '{}');

  const conf = dbManager.prepare('SELECT * FROM lesson_preparation_confirmations WHERE id = ?').get('lpc-1');
  assert.equal(conf.confirmed_by, 'prof.rossi');

  dbManager.close();

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
