/**
 * Identity-scoped student draft cache. It never stores the bearer token itself.
 * The cache is a recovery aid, not proof of identity or server persistence.
 */
const DB_NAME = 'TeacherService_StudentOfflineCache';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const MAX_LOCAL_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const retiredSessions = new Set();

function sessionIdentity(session) {
  return session?.token || session?.cacheKey || null;
}

function recordKey(session, assessmentId) {
  if (!session?.classId || !session?.studentId || !assessmentId) return null;
  // Stable across attempt-token renewal, but scoped to the exact class,
  // declared roster identity and assessment. The cache is consulted only after
  // the server has validated that same identity for a newly issued attempt.
  return `${session.classId}:${session.studentId}:${assessmentId}`;
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

export async function saveOfflineDraft(session, assessmentId, draftData) {
  let db;
  const identity = sessionIdentity(session);
  try {
    if (!session?.studentId || !assessmentId || !identity || retiredSessions.has(identity)) return false;
    const id = recordKey(session, assessmentId);
    if (!id || retiredSessions.has(identity)) return false;
    db = await openDb();
    if (!db) return false;
    const record = {
      id,
      classId: session.classId,
      studentId: session.studentId,
      assessmentId,
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
    const id = recordKey(session, assessmentId);
    if (!id) return null;
    db = await openDb();
    if (!db) return null;
    let record = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    if (!record) {
      // Migrate a draft created by the previous token-scoped key. Migration is
      // allowed only for the exact selected student + activity, after the
      // server supplied a session for that same pair.
      const previousRecords = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      const candidate = previousRecords
        .filter((item) => item.id !== id && item.studentId === session.studentId
          && item.assessmentId === assessmentId
          && (!item.classId || item.classId === session.classId)
          && Date.now() - item.updatedAt <= MAX_LOCAL_AGE_MS)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
      if (!candidate) return null;
      record = { ...candidate, id, classId: session.classId };
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
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
    const id = recordKey(session, assessmentId);
    if (!id) return false;
    db = await openDb();
    if (!db) return false;
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      let removed = false;
      request.onsuccess = () => {
        for (const record of request.result || []) {
          if (record.id === id || (record.studentId === session.studentId
            && record.assessmentId === assessmentId
            && (!record.classId || record.classId === session.classId))) {
            store.delete(record.id);
            removed = true;
          }
        }
      };
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve(removed);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Offline cache cleanup aborted'));
    });
  } catch {
    return false;
  } finally {
    db?.close();
  }
}
