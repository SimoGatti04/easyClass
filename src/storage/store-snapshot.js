import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MANIFEST_NAME = 'snapshot-manifest.json';
const SNAPSHOT_FORMAT_VERSION = 1;

function resolved(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty path`);
  return path.resolve(value);
}

function isWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function listRegularFiles(root, relative = '') {
  const absolute = path.join(root, relative);
  const entries = fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  for (const entry of entries) {
    const childRelative = relative ? path.join(relative, entry.name) : entry.name;
    const childPath = path.join(root, childRelative);
    const stat = fs.lstatSync(childPath);
    if (stat.isSymbolicLink()) throw new Error(`Snapshot refuses symbolic link in FileStore: ${childRelative}`);
    if (stat.isDirectory()) files.push(...listRegularFiles(root, childRelative));
    else if (stat.isFile()) files.push(childRelative.split(path.sep).join('/'));
    else throw new Error(`Snapshot refuses non-regular FileStore entry: ${childRelative}`);
  }
  return files;
}

function inspectDatabase(filePath) {
  const db = new DatabaseSync(filePath);
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get()?.integrity_check;
    const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all();
    if (integrity !== 'ok') throw new Error(`SQLite integrity_check failed: ${integrity || 'no result'}`);
    if (foreignKeyViolations.length) throw new Error(`SQLite foreign_key_check found ${foreignKeyViolations.length} violation(s)`);
    return { integrity, foreignKeyViolations: 0 };
  } finally {
    db.close();
  }
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function hashTree(root) {
  return listRegularFiles(root).map((relativePath) => {
    const filePath = path.join(root, ...relativePath.split('/'));
    return { path: relativePath, bytes: fs.statSync(filePath).size, sha256: sha256File(filePath) };
  });
}

function assertDisjoint(target, ...sources) {
  for (const source of sources) {
    if (isWithin(target, source) || isWithin(source, target)) {
      throw new Error('Snapshot, source and restore paths must not overlap');
    }
  }
}

/**
 * Create a consistent SQLite + FileStore snapshot in a new directory.
 * Call only after application writers have been stopped/quiesced. `VACUUM INTO`
 * produces a clean SQLite database independent of sidecar WAL files.
 */
export function createStoreSnapshot({ databasePath, fileStorePath, snapshotPath }) {
  const sourceDb = resolved(databasePath, 'databasePath');
  const sourceFiles = resolved(fileStorePath, 'fileStorePath');
  const target = resolved(snapshotPath, 'snapshotPath');
  if (!fs.statSync(sourceDb).isFile()) throw new Error('SQLite source is not a regular file');
  if (!fs.statSync(sourceFiles).isDirectory()) throw new Error('FileStore source is not a directory');
  assertDisjoint(target, sourceDb, sourceFiles);
  if (fs.existsSync(target)) throw new Error('Snapshot target already exists; refusing to overwrite');

  fs.mkdirSync(path.dirname(target), { recursive: true });
  const stage = fs.mkdtempSync(path.join(path.dirname(target), '.teacher-service-snapshot-'));
  const stagedDb = path.join(stage, 'database.sqlite');
  const stagedFiles = path.join(stage, 'files');
  try {
    const db = new DatabaseSync(sourceDb);
    try {
      db.exec(`VACUUM INTO ${sqlString(stagedDb)}`);
    } finally {
      db.close();
    }
    const databaseChecks = inspectDatabase(stagedDb);
    fs.cpSync(sourceFiles, stagedFiles, { recursive: true, errorOnExist: true, force: false, dereference: false });
    const manifest = {
      formatVersion: SNAPSHOT_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      database: { file: 'database.sqlite', bytes: fs.statSync(stagedDb).size, sha256: sha256File(stagedDb), ...databaseChecks },
      files: hashTree(stagedFiles)
    };
    fs.writeFileSync(path.join(stage, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    fs.renameSync(stage, target);
    return { snapshotPath: target, fileCount: manifest.files.length, databaseSha256: manifest.database.sha256 };
  } catch (error) {
    fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
}

function readAndValidateSnapshot(snapshotPath) {
  const manifestPath = path.join(snapshotPath, MANIFEST_NAME);
  const manifestStat = fs.lstatSync(manifestPath);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink()) throw new Error('Snapshot manifest must be a regular file');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest?.formatVersion !== SNAPSHOT_FORMAT_VERSION || manifest?.database?.file !== 'database.sqlite' || !Array.isArray(manifest.files)) {
    throw new Error('Unsupported or invalid snapshot manifest');
  }
  const dbPath = path.join(snapshotPath, 'database.sqlite');
  if (fs.lstatSync(dbPath).isSymbolicLink() || !fs.statSync(dbPath).isFile()) throw new Error('Snapshot database must be a regular file');
  if (fs.statSync(dbPath).size !== manifest.database.bytes || sha256File(dbPath) !== manifest.database.sha256) {
    throw new Error('Snapshot database hash/size mismatch');
  }
  const filesRoot = path.join(snapshotPath, 'files');
  if (!fs.statSync(filesRoot).isDirectory()) throw new Error('Snapshot FileStore is missing');
  const actual = hashTree(filesRoot);
  const expected = [...manifest.files].sort((a, b) => a.path.localeCompare(b.path));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Snapshot FileStore hash/size inventory mismatch');
  const checks = inspectDatabase(dbPath);
  if (checks.integrity !== manifest.database.integrity || checks.foreignKeyViolations !== manifest.database.foreignKeyViolations) {
    throw new Error('Snapshot SQLite integrity metadata mismatch');
  }
  return { manifest, dbPath, filesRoot };
}

/** Verify snapshot hashes, the FileStore inventory, and SQLite integrity without restoring. */
export function verifyStoreSnapshot(snapshotPath) {
  const { manifest } = readAndValidateSnapshot(resolved(snapshotPath, 'snapshotPath'));
  return {
    createdAt: manifest.createdAt,
    databaseSha256: manifest.database.sha256,
    databaseBytes: manifest.database.bytes,
    fileCount: manifest.files.length,
    totalFileBytes: manifest.files.reduce((total, entry) => total + entry.bytes, 0),
    integrity: manifest.database.integrity,
    foreignKeyViolations: manifest.database.foreignKeyViolations
  };
}

/** Restore a verified snapshot only into new, non-existing targets. */
export function restoreStoreSnapshot({ snapshotPath, databasePath, fileStorePath }) {
  const snapshot = resolved(snapshotPath, 'snapshotPath');
  const targetDb = resolved(databasePath, 'databasePath');
  const targetFiles = resolved(fileStorePath, 'fileStorePath');
  assertDisjoint(targetDb, snapshot, targetFiles);
  assertDisjoint(targetFiles, snapshot, targetDb);
  if (fs.existsSync(targetDb) || fs.existsSync(targetFiles)) {
    throw new Error('Restore targets must not exist; refusing to overwrite or merge data');
  }
  const { manifest, dbPath, filesRoot } = readAndValidateSnapshot(snapshot);
  fs.mkdirSync(path.dirname(targetDb), { recursive: true });
  fs.mkdirSync(path.dirname(targetFiles), { recursive: true });
  const dbStage = path.join(path.dirname(targetDb), `.teacher-service-db-restore-${crypto.randomUUID()}`);
  const filesStage = path.join(path.dirname(targetFiles), `.teacher-service-files-restore-${crypto.randomUUID()}`);
  let dbInstalled = false;
  let filesInstalled = false;
  try {
    fs.copyFileSync(dbPath, dbStage, fs.constants.COPYFILE_EXCL);
    fs.cpSync(filesRoot, filesStage, { recursive: true, errorOnExist: true, force: false, dereference: false });
    if (sha256File(dbStage) !== manifest.database.sha256 || JSON.stringify(hashTree(filesStage)) !== JSON.stringify(manifest.files)) {
      throw new Error('Staged restore verification failed');
    }
    inspectDatabase(dbStage);
    fs.renameSync(dbStage, targetDb);
    dbInstalled = true;
    fs.renameSync(filesStage, targetFiles);
    filesInstalled = true;
    return { databasePath: targetDb, fileStorePath: targetFiles, fileCount: manifest.files.length };
  } catch (error) {
    if (filesInstalled) fs.rmSync(targetFiles, { recursive: true, force: true });
    if (dbInstalled) fs.rmSync(targetDb, { force: true });
    throw error;
  } finally {
    fs.rmSync(dbStage, { force: true });
    fs.rmSync(filesStage, { recursive: true, force: true });
  }
}


/**
 * Mandatory complete state verification of restored SQLite + FileStore volumes
 * before they can ever be attached or mounted to the running application workload.
 * Verifies existence of both targets, checks SQLite integrity and FK pragmas,
 * verifies absence of lingering staging directories, and optionally checks byte-for-byte
 * hash consistency against the original snapshot manifest.
 */
export function verifyStorePair({ databasePath, fileStorePath, snapshotPath = null }) {
  const dbFile = resolved(databasePath, "databasePath");
  const filesDir = resolved(fileStorePath, "fileStorePath");
  if (!fs.existsSync(dbFile) || !fs.statSync(dbFile).isFile()) {
    throw new Error(`Restored database file does not exist or is not a regular file: ${dbFile}`);
  }
  if (!fs.existsSync(filesDir) || !fs.statSync(filesDir).isDirectory()) {
    throw new Error(`Restored FileStore directory does not exist or is not a directory: ${filesDir}`);
  }

  // Check for lingering restore staging directories in parent folders
  const dbParent = path.dirname(dbFile);
  const filesParent = path.dirname(filesDir);
  const lingeringDbStages = fs.readdirSync(dbParent).filter(f => f.startsWith(".teacher-service-db-restore-"));
  if (lingeringDbStages.length > 0) {
    throw new Error(`Lingering restore staging detected in ${dbParent}: ${lingeringDbStages.join(", ")}`);
  }
  const lingeringFilesStages = fs.readdirSync(filesParent).filter(f => f.startsWith(".teacher-service-files-restore-"));
  if (lingeringFilesStages.length > 0) {
    throw new Error(`Lingering restore staging detected in ${filesParent}: ${lingeringFilesStages.join(", ")}`);
  }

  // Database PRAGMA checks
  const dbChecks = inspectDatabase(dbFile);

  // FileStore check
  const filesOnDisk = listRegularFiles(filesDir);

  let manifestMatch = null;
  if (snapshotPath) {
    const snap = resolved(snapshotPath, "snapshotPath");
    const { manifest } = readAndValidateSnapshot(snap);
    const dbHash = sha256File(dbFile);
    if (dbHash !== manifest.database.sha256) {
      throw new Error(`Restored database SHA-256 (${dbHash}) does not match snapshot manifest (${manifest.database.sha256})`);
    }
    const currentFilesHash = hashTree(filesDir);
    if (JSON.stringify(currentFilesHash) !== JSON.stringify(manifest.files)) {
      throw new Error("Restored FileStore contents do not match snapshot manifest");
    }
    manifestMatch = true;
  }

  return {
    valid: true,
    databasePath: dbFile,
    fileStorePath: filesDir,
    fileCount: filesOnDisk.length,
    integrity: dbChecks.integrity,
    foreignKeyViolations: dbChecks.foreignKeyViolations,
    manifestMatch
  };
}
