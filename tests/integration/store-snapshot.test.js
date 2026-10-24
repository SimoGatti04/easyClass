import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';

test('isolated SQLite + FileStore snapshot restores content, material version history, and attachment bytes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teacher-store-snapshot-'));
  const sourceDbPath = path.join(root, 'source', 'teacher.sqlite');
  const sourceFilesPath = path.join(root, 'source', 'files');
  const snapshotPath = path.join(root, 'snapshot');
  const restoredDbPath = path.join(root, 'restored', 'teacher.sqlite');
  const restoredFilesPath = path.join(root, 'restored', 'files');
  let sourceService;
  let restoredService;
  t.after(() => {
    try { restoredService?.close(); } catch {}
    try { sourceService?.close(); } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  });

  sourceService = new TeacherService({
    dbManager: new DatabaseManager(sourceDbPath).init(),
    fileStore: new FileStore(sourceFilesPath),
    mockAi: true
  });
  const classroom = sourceService.createClass({ name: 'Fixture Recovery 3A', academicYear: '2026/2027' });
  const material = sourceService.createMaterial({
    title: 'Synthetic versioned material',
    contentText: 'T1 fixture version one: relational keys connect rows.',
    pedagogicalRole: 'student_material',
    classId: classroom.id
  });
  sourceService.updateMaterial(material.id, {
    contentText: 'C6 fixture version two: the same versioned resource remains recoverable.',
    changeSummary: 'Synthetic migration rehearsal'
  });
  const attachmentBytes = Buffer.from('Synthetic attachment payload — no student data.', 'utf8');
  const storedAttachment = sourceService.fileStore.saveAttachment('synthetic-evidence.txt', attachmentBytes);
  const attachmentRelativePath = path.relative(sourceFilesPath, storedAttachment.filePath);
  sourceService.close();
  sourceService = null;

  const cli = path.resolve(process.cwd(), 'bin/teacher-service-store-snapshot.js');
  const runCli = (...args) => JSON.parse(execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' }));
  const snapshot = runCli('create', sourceDbPath, sourceFilesPath, snapshotPath);
  assert.equal(snapshot.fileCount, 3, 'two material versions and one attachment are included');
  assert.match(snapshot.databaseSha256, /^[a-f0-9]{64}$/);
  const verifiedSnapshot = runCli('verify', snapshotPath);
  assert.equal(verifiedSnapshot.integrity, 'ok');
  assert.equal(verifiedSnapshot.foreignKeyViolations, 0);
  assert.equal(verifiedSnapshot.fileCount, snapshot.fileCount);

  const restore = runCli('restore', snapshotPath, restoredDbPath, restoredFilesPath);
  assert.equal(restore.fileCount, snapshot.fileCount);
  assert.deepEqual(fs.readFileSync(path.join(restoredFilesPath, attachmentRelativePath)), attachmentBytes);

  const verificationDb = new DatabaseSync(restoredDbPath);
  try {
    assert.equal(verificationDb.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.deepEqual(verificationDb.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(verificationDb.prepare('SELECT COUNT(*) AS count FROM resource_versions WHERE resource_id = ?').get(material.id).count, 2);
    const attachmentHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(restoredFilesPath, attachmentRelativePath))).digest('hex');
    assert.equal(attachmentHash, crypto.createHash('sha256').update(attachmentBytes).digest('hex'));
  } finally {
    verificationDb.close();
  }

  restoredService = new TeacherService({
    dbManager: new DatabaseManager(restoredDbPath).init(),
    fileStore: new FileStore(restoredFilesPath),
    mockAi: true
  });
  assert.equal(restoredService.getMaterial(material.id, 1).content, 'T1 fixture version one: relational keys connect rows.');
  assert.equal(restoredService.getMaterial(material.id, 2).content, 'C6 fixture version two: the same versioned resource remains recoverable.');
});
