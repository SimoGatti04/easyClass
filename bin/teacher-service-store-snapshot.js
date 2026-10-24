#!/usr/bin/env node
import { createStoreSnapshot, restoreStoreSnapshot, verifyStoreSnapshot } from '../src/storage/store-snapshot.js';

function usage() {
  console.error(`Usage:
  node bin/teacher-service-store-snapshot.js create <database.sqlite> <filestore-dir> <new-snapshot-dir>
  node bin/teacher-service-store-snapshot.js verify <snapshot-dir>
  node bin/teacher-service-store-snapshot.js restore <snapshot-dir> <new-database.sqlite> <new-filestore-dir>

Create and restore must run with application writers stopped. Restore refuses existing targets.`);
  process.exitCode = 2;
}

try {
  const [operation, ...args] = process.argv.slice(2);
  let result;
  if (operation === 'create' && args.length === 3) {
    result = createStoreSnapshot({ databasePath: args[0], fileStorePath: args[1], snapshotPath: args[2] });
  } else if (operation === 'verify' && args.length === 1) {
    result = verifyStoreSnapshot(args[0]);
  } else if (operation === 'restore' && args.length === 3) {
    result = restoreStoreSnapshot({ snapshotPath: args[0], databasePath: args[1], fileStorePath: args[2] });
  } else {
    usage();
  }
  if (result) console.log(JSON.stringify({ ok: true, ...result }, null, 2));
} catch (error) {
  console.error(`Store snapshot ${process.argv[2] || 'operation'} failed: ${error.message}`);
  process.exitCode = 1;
}
