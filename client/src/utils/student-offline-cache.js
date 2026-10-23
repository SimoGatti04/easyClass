/**
 * Session-scoped student draft cache. It never stores the bearer token itself.
 * The cache is a recovery aid, not proof of identity or server persistence.
 */
const DB_NAME = 'TeacherService_StudentOfflineCache';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const MAX_LOCAL_AGE_MS = 24 * 60 * 60 * 1000;
const retiredSessions = new Set();

function sessionIdentity(session) {
  return session?.token || session?.cacheKey || null;
}

async function getSessionKey(session) {
  if (session?.token && typeof session.token === 'string' && globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(session.token);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  }
  // On a mobile browser opened over plain LAN HTTP, SubtleCrypto may be unavailable.
  // Use a random per-login key from sessionStorage; never persist the bearer token.
  return typeof session?.cacheKey === 'string' && session.cacheKey.length >= 24 ? session.cacheKey : null;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) return resolve(null);
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function recordKey(sessionKey, studentId, assessmentId) {
  return `${sessionKey}:${studentId}:${assessmentId}`;
}

export async function saveOfflineDraft(session, assessmentId, draftData) {
  let db;
  const identity = sessionIdentity(session);
  try {
    if (!session?.studentId || !assessmentId || !identity || retiredSessions.has(identity)) return false;
    const sessionKey = await getSessionKey(session);
    if (!sessionKey || retiredSessions.has(identity)) return false;
    db = await openDb();
    if (!db) return false;
    const record = {
      id: recordKey(sessionKey, session.studentId, assessmentId),
      studentId: session.studentId,
      assessmentId,
      sessionKey,
      responses: draftData.responses || {},
      attachments: draftData.attachments || {},
      revision: Number.isInteger(draftData.revision) ? draftData.revision : 0,
      baseServerRevision: Number.isInteger(draftData.baseServerRevision) ? draftData.baseServerRevision : 0,
      seatRow: draftData.seatRow || null,
      seatDesk: draftData.seatDesk || null,
      leftNeighborId: draftData.leftNeighborId || null,
      rightNeighborId: draftData.rightNeighborId || null,
      activity: draftData.activity || null,
      timer: draftData.timer || null,
      updatedAt: Date.now()
    };
    return await new Promise((resolve, reject) => {
      let wroteRecord = false;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const existingRequest = store.get(record.id);
      existingRequest.onsuccess = () => {
        if (retiredSessions.has(identity)) return;
        const existing = existingRequest.result;
        const incomingIsNewer = !existing || record.revision > existing.revision;
        const confirmsSameRevision = existing
          && record.revision === existing.revision
          && record.baseServerRevision >= existing.baseServerRevision;
        if (incomingIsNewer || confirmsSameRevision) {
          store.put(record);
          wroteRecord = true;
        }
      };
      existingRequest.onerror = () => reject(existingRequest.error);
      tx.oncomplete = () => resolve(wroteRecord);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Offline cache transaction aborted'));
    });
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

export async function loadOfflineDraft(session, assessmentId) {
  let db;
  try {
    if (!session?.studentId || !assessmentId) return null;
    const sessionKey = await getSessionKey(session);
    if (!sessionKey) return null;
    db = await openDb();
    if (!db) return null;
    const id = recordKey(sessionKey, session.studentId, assessmentId);
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    if (!record) return null;
    if (Date.now() - record.updatedAt > MAX_LOCAL_AGE_MS) {
      await deleteRecord(db, id);
      return null;
    }
    return record;
  } catch {
    return null;
  } finally {
    db?.close();
  }
}

async function deleteRecord(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).delete(id);
  });
}

export async function clearOfflineDraft(session, assessmentId) {
  let db;
  const identity = sessionIdentity(session);
  // Retire synchronously so a delayed IndexedDB write cannot recreate a draft after
  // a confirmed submission or an explicit session exit.
  if (identity) retiredSessions.add(identity);
  try {
    if (!session?.studentId || !assessmentId) return false;
    const sessionKey = await getSessionKey(session);
    if (!sessionKey) return false;
    db = await openDb();
    if (!db) return false;
    return await deleteRecord(db, recordKey(sessionKey, session.studentId, assessmentId));
  } catch {
    return false;
  } finally {
    db?.close();
  }
}
