import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DatabaseManager } from '../../src/db/database.js';
import { FileStore } from '../../src/storage/filestore.js';
import { TeacherService } from '../../src/services/teacher-service.js';
import cp from 'node:child_process';
import { createStoreSnapshot, restoreStoreSnapshot, verifyStoreSnapshot, verifyStorePair } from '../../src/storage/store-snapshot.js';

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

  await t.test("8. Real child process SIGKILL before database install proves catch cannot run and verifyStorePair rejects target", async () => {
    const killTargetDir = path.join(root, "sigkill1-dest");
    fs.mkdirSync(killTargetDir, { recursive: true });
    const killDb = path.join(killTargetDir, "teacher.sqlite");
    const killFiles = path.join(killTargetDir, "files");

    // Spawn child script that starts restore and pauses BEFORE the first rename (database install)
    const childScript = `
      import fs from "node:fs";
      import path from "node:path";
      import { restoreStoreSnapshot } from "${path.resolve(process.cwd(), "src/storage/store-snapshot.js")}";

      // Intercept fs.renameSync to hang before performing the first rename
      const origRename = fs.renameSync;
      fs.renameSync = function(from, to) {
        process.stdout.write("PRE_DB_RENAME\\n");
        // Hang indefinitely waiting for SIGKILL
        while (true) {}
      };

      try {
        restoreStoreSnapshot({
          snapshotPath: "${snapshotPath}",
          databasePath: "${killDb}",
          fileStorePath: "${killFiles}"
        });
      } catch (err) {
        process.stdout.write("CAUGHT_ERROR\\n");
      } finally {
        process.stdout.write("FINALLY_RAN\\n");
      }
    `;

    const child = cp.spawn("node", ["--input-type=module", "-e", childScript]);
    let output = "";
    child.stdout.on("data", chunk => {
      output += chunk.toString("utf8");
      if (output.includes("PRE_DB_RENAME")) {
        child.kill("SIGKILL");
      }
    });

    const exitPromise = new Promise(resolve => child.on("exit", (code, signal) => resolve({ code, signal })));
    const exitResult = await exitPromise;

    assert.equal(exitResult.signal, "SIGKILL");
    assert.equal(output.includes("CAUGHT_ERROR"), false, "Catch must NOT run on SIGKILL");
    assert.equal(output.includes("FINALLY_RAN"), false, "Finally must NOT run on SIGKILL");
    assert.equal(fs.existsSync(killDb), false, "DB must not exist because process was killed before first rename");

    assert.throws(() => {
      verifyStorePair({
        databasePath: killDb,
        fileStorePath: killFiles,
        snapshotPath
      });
    }, /does not exist or is not a regular file/);
  });

  await t.test("9. Real child process SIGKILL after database install but before FileStore install leaves half-restored state that verifyStorePair rejects", async () => {
    const killTargetDir = path.join(root, "sigkill2-dest");
    fs.mkdirSync(killTargetDir, { recursive: true });
    const killDb = path.join(killTargetDir, "teacher.sqlite");
    const killFiles = path.join(killTargetDir, "files");

    // Spawn child script that completes the database rename (step 1) but hangs before FileStore rename (step 2)
    const childScript = `
      import fs from "node:fs";
      import path from "node:path";
      import { restoreStoreSnapshot } from "${path.resolve(process.cwd(), "src/storage/store-snapshot.js")}";

      const origRename = fs.renameSync;
      let renameCount = 0;
      fs.renameSync = function(from, to) {
        renameCount++;
        if (renameCount === 1) {
          // Complete database rename: targetDb is now on disk!
          origRename(from, to);
          process.stdout.write("DB_INSTALLED_BEFORE_FILES\\n");
          // Hang before FileStore rename
          while (true) {}
        }
        return origRename(from, to);
      };

      try {
        restoreStoreSnapshot({
          snapshotPath: "${snapshotPath}",
          databasePath: "${killDb}",
          fileStorePath: "${killFiles}"
        });
      } catch (err) {
        process.stdout.write("CAUGHT_ERROR\\n");
      } finally {
        process.stdout.write("FINALLY_RAN\\n");
      }
    `;

    const child = cp.spawn("node", ["--input-type=module", "-e", childScript]);
    let output = "";
    child.stdout.on("data", chunk => {
      output += chunk.toString("utf8");
      if (output.includes("DB_INSTALLED_BEFORE_FILES")) {
        child.kill("SIGKILL");
      }
    });

    const exitPromise = new Promise(resolve => child.on("exit", (code, signal) => resolve({ code, signal })));
    const exitResult = await exitPromise;

    assert.equal(exitResult.signal, "SIGKILL");
    assert.equal(output.includes("CAUGHT_ERROR"), false, "Catch must NOT run on SIGKILL");
    assert.equal(output.includes("FINALLY_RAN"), false, "Finally must NOT run on SIGKILL");

    // Critical invariant check: DB exists on disk, FileStore does NOT!
    assert.equal(fs.existsSync(killDb), true, "Database was installed before SIGKILL");
    assert.equal(fs.existsSync(killFiles), false, "FileStore was NOT installed before SIGKILL");

    // Pre-attachment check must reject this half-installed target due to missing FileStore and lingering staging
    assert.throws(() => {
      verifyStorePair({
        databasePath: killDb,
        fileStorePath: killFiles,
        snapshotPath
      });
    }, /Restored FileStore directory does not exist or is not a directory|Lingering restore staging detected/);

    // Also verify that CLI verify-target exits with error
    const cliCheck = cp.spawnSync("node", [
      path.resolve(process.cwd(), "bin/teacher-service-store-snapshot.js"),
      "verify-target",
      killDb,
      killFiles,
      snapshotPath
    ]);
    assert.notEqual(cliCheck.status, 0, "CLI verify-target must exit non-zero on half-restored targets");

    // Clean up debris left by the killed process
    const parentEntries = fs.readdirSync(killTargetDir);
    for (const entry of parentEntries) {
      fs.rmSync(path.join(killTargetDir, entry), { recursive: true, force: true });
    }

    // A clean, uninterrupted restore into this directory passes verification
    restoreStoreSnapshot({
      snapshotPath,
      databasePath: killDb,
      fileStorePath: killFiles
    });

    const verifyResult = verifyStorePair({
      databasePath: killDb,
      fileStorePath: killFiles,
      snapshotPath
    });
    assert.equal(verifyResult.valid, true);
    assert.equal(verifyResult.manifestMatch, true);
    assert.equal(verifyResult.integrity, "ok");
  });
});
