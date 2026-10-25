import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';
import { createStoreSnapshot, restoreStoreSnapshot, verifyStoreSnapshot } from '../../src/storage/store-snapshot.js';

test('Snapshot & Restore partial failure handling, cleanup, and retry suite', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-failures-'));
  const sourceDbPath = path.join(root, 'source', 'teacher.sqlite');
  const sourceFilesPath = path.join(root, 'source', 'files');
  const snapshotPath = path.join(root, 'valid-snapshot');

  fs.mkdirSync(path.join(root, 'source'), { recursive: true });
  fs.mkdirSync(sourceFilesPath, { recursive: true });

  // Initialize source data
  const service = new TeacherService({
    dbManager: new DatabaseManager(sourceDbPath).init(),
    fileStore: new FileStore(sourceFilesPath),
    mockAi: true
  });
  const cls = service.createClass({ name: 'Partial Failure 4B', academicYear: '2026/2027' });
  const mat = service.createMaterial({
    title: 'Atomic Recovery Notes',
    contentText: 'Testing failure handling during backup and restore.',
    pedagogicalRole: 'student_material',
    classId: cls.id
  });
  const attachment = service.fileStore.saveAttachment('atomic.txt', Buffer.from('atomic test content', 'utf8'));
  service.close();

  // Create valid snapshot
  createStoreSnapshot({
    databasePath: sourceDbPath,
    fileStorePath: sourceFilesPath,
    snapshotPath
  });

  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  await t.test('1. Snapshot creation fails cleanly if snapshot target already exists (no overwrite)', () => {
    assert.throws(() => {
      createStoreSnapshot({
        databasePath: sourceDbPath,
        fileStorePath: sourceFilesPath,
        snapshotPath
      });
    }, /Snapshot target already exists/);
  });

  await t.test('2. Snapshot creation cleans staging on unexpected error', () => {
    const brokenSnapshotPath = path.join(root, 'broken-snapshot');
    // Pass non-existent DB path
    assert.throws(() => {
      createStoreSnapshot({
        databasePath: path.join(root, 'non-existent.db'),
        fileStorePath: sourceFilesPath,
        snapshotPath: brokenSnapshotPath
      });
    }, /ENOENT|not a regular file/);

    // Staging and target must not exist
    assert.equal(fs.existsSync(brokenSnapshotPath), false);
    const parentFiles = fs.readdirSync(root);
    assert.equal(parentFiles.some(f => f.startsWith('.teacher-service-snapshot-')), false);
  });

  await t.test('3. Restore refuses to overwrite existing destination files/directories', () => {
    const existingDb = path.join(root, 'existing-dest', 'teacher.sqlite');
    const existingFiles = path.join(root, 'existing-dest', 'files');
    fs.mkdirSync(path.dirname(existingDb), { recursive: true });
    fs.writeFileSync(existingDb, 'dummy', 'utf8');

    assert.throws(() => {
      restoreStoreSnapshot({
        snapshotPath,
        databasePath: existingDb,
        fileStorePath: existingFiles
      });
    }, /Restore targets must not exist/);
  });

  await t.test('4. Restore detects corrupted snapshot database and cleans staging without touching target', () => {
    const corruptSnapshotPath = path.join(root, 'corrupt-db-snapshot');
    fs.cpSync(snapshotPath, corruptSnapshotPath, { recursive: true });

    // Tamper with snapshot database
    const dbFile = path.join(corruptSnapshotPath, 'database.sqlite');
    fs.appendFileSync(dbFile, 'tampered bytes');

    const targetDb = path.join(root, 'tampered-restore', 'teacher.sqlite');
    const targetFiles = path.join(root, 'tampered-restore', 'files');

    assert.throws(() => {
      restoreStoreSnapshot({
        snapshotPath: corruptSnapshotPath,
        databasePath: targetDb,
        fileStorePath: targetFiles
      });
    }, /Snapshot database hash\/size mismatch/);

    // Target must NOT exist
    assert.equal(fs.existsSync(targetDb), false);
    assert.equal(fs.existsSync(targetFiles), false);
  });

  await t.test('5. Restore detects tampered FileStore and aborts cleanly', () => {
    const corruptFileSnapshot = path.join(root, 'corrupt-file-snapshot');
    fs.cpSync(snapshotPath, corruptFileSnapshot, { recursive: true });

    // Delete a file in snapshot FileStore
    const filesDir = path.join(corruptFileSnapshot, 'files');
    const subEntries = fs.readdirSync(filesDir);
    if (subEntries.length > 0) {
      fs.rmSync(path.join(filesDir, subEntries[0]), { recursive: true, force: true });
    }

    const targetDb = path.join(root, 'tampered-file-restore', 'teacher.sqlite');
    const targetFiles = path.join(root, 'tampered-file-restore', 'files');

    assert.throws(() => {
      restoreStoreSnapshot({
        snapshotPath: corruptFileSnapshot,
        databasePath: targetDb,
        fileStorePath: targetFiles
      });
    }, /Snapshot FileStore hash\/size inventory mismatch/);

    // Target must NOT exist
    assert.equal(fs.existsSync(targetDb), false);
    assert.equal(fs.existsSync(targetFiles), false);
  });

  await t.test('6. Successful restore into clean target directory succeeds and allows retry', () => {
    const targetDb = path.join(root, 'clean-restore', 'teacher.sqlite');
    const targetFiles = path.join(root, 'clean-restore', 'files');

    const result = restoreStoreSnapshot({
      snapshotPath,
      databasePath: targetDb,
      fileStorePath: targetFiles
    });

    assert.ok(fs.existsSync(targetDb));
    assert.ok(fs.existsSync(targetFiles));
    assert.equal(result.fileCount >= 1, true);

    // Service can open restored store
    const restoredService = new TeacherService({
      dbManager: new DatabaseManager(targetDb).init(),
      fileStore: new FileStore(targetFiles),
      mockAi: true
    });
    const classes = restoredService.listClasses();
    assert.equal(classes.length, 1);
    assert.equal(classes[0].name, 'Partial Failure 4B');
    restoredService.close();
  });
  await t.test('7. Fault injection / crash during FileStore install rolls back database and leaves zero partial state', () => {
    const originalRename = fs.renameSync;
    let renameCalls = 0;
    fs.renameSync = function(from, to) {
      renameCalls++;
      if (renameCalls === 2) {
        throw new Error('Simulated I/O crash during filesStage rename');
      }
      return originalRename.apply(this, arguments);
    };

    const targetDb = path.join(root, 'crash-test-dest', 'teacher.sqlite');
    const targetFiles = path.join(root, 'crash-test-dest', 'files');

    assert.throws(() => {
      restoreStoreSnapshot({
        snapshotPath,
        databasePath: targetDb,
        fileStorePath: targetFiles
      });
    }, /Simulated I\/O crash during filesStage rename/);

    fs.renameSync = originalRename;

    // Both targetDb and targetFiles must NOT exist because rollback hook cleaned up targetDb!
    assert.equal(fs.existsSync(targetDb), false, "targetDb must be uninstalled if FileStore install fails");
    assert.equal(fs.existsSync(targetFiles), false, "targetFiles must not exist");
  });
});
