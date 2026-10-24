import React, { createElement as h, useState, useEffect, useRef, useCallback } from 'react';
import { clearOfflineDraft, loadOfflineDraft, saveOfflineDraft } from '../utils/student-offline-cache.js';

export function StudentArea({ onNavigate }) {
  // Step: 'code_entry' | 'seat_declaration' | 'in_progress' | 'submitted'
  const [step, setStep] = useState('code_entry');

  // Direct code or manual selection
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [session, setSession] = useState(null); // { token, studentName, studentId, classId, className, activityTitle, ... }



  // Seat Map declaration state
  const [seatRow, setSeatRow] = useState('Fila 1');
  const [seatDesk, setSeatDesk] = useState('Banco 1');
  const [leftNeighborId, setLeftNeighborId] = useState('none');
  const [rightNeighborId, setRightNeighborId] = useState('none');
  const [classmates, setClassmates] = useState([]);

  // Active attempt state
  const [activityData, setActivityData] = useState(null);
  const [responses, setResponses] = useState({}); // itemId -> string
  const [attachments, setAttachments] = useState({}); // itemId -> { attachmentPath, attachmentName, size }

  // Autosave, revision, and concurrency state
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [persistedRevision, setPersistedRevision] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submissionConfirmed, setSubmissionConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [draftLocation, setDraftLocation] = useState('server'); // server | local | conflict
  const [conflictState, setConflictState] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(null);
  const [timerWarning, setTimerWarning] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [preview, setPreview] = useState(null);
  const [uploadingItem, setUploadingItem] = useState(null);

  const autosaveTimerRef = useRef(null);
  const autosaveSeqRef = useRef(0);
  const isSubmittedRef = useRef(false);
  const activeAutosaveAbortRef = useRef(null);
  const serverRevisionRef = useRef(0);
  const clientRevisionRef = useRef(0);
  const responsesRef = useRef({});
  const attachmentsRef = useRef({});
  const submitInFlightRef = useRef(false);
  const timerDeadlineRef = useRef(null);
  const timerInfoRef = useRef(null);
  const previousOnlineRef = useRef(isOnline);
  const timerOffsetRef = useRef(0);
  const warnedTimerRef = useRef(new Set());
  const timerExpirySyncRef = useRef(false);

  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // Listen for online/offline events. A local draft is never presented as server-saved.
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setDraftLocation('local');
      setSaveStatus('error');
      setErrorMessage('Connessione persa. Le risposte recenti sono conservate solo su questo dispositivo e non ancora sul server.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Restore a session after reload. If the network is unavailable, the cached session
  // snapshot and IndexedDB draft permit read/edit recovery but not server submission.
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
    const codeFromUrl = urlParams.get('code') || hashParams.get('code');
    if (codeFromUrl) {
      setAccessCodeInput(codeFromUrl.toUpperCase());
      claimAccessCode(codeFromUrl.toUpperCase());
      return;
    }

    const storedToken = sessionStorage.getItem('teacher_service_student_token');
    if (!storedToken) return;
    fetch('/api/student/session', { headers: { 'X-Student-Token': storedToken } })
      .then(res => res.ok ? res.json() : Promise.reject(new Error('Sessione non disponibile')))
      .then(data => {
        if (data.session) initStudentSession(data.session);
      })
      .catch(async () => {
        const rawSnapshot = sessionStorage.getItem('teacher_service_student_snapshot');
        if (!rawSnapshot) return;
        try {
          const snapshot = JSON.parse(rawSnapshot);
          const cacheKey = sessionStorage.getItem('teacher_service_student_cache_key');
          if (snapshot.assessmentId && snapshot.studentId && cacheKey) {
            await initStudentSession({ ...snapshot, token: storedToken, cacheKey }, { allowOffline: true });
          }
        } catch {
          sessionStorage.removeItem('teacher_service_student_snapshot');
        }
      });
  }, []);

  // Claim access code
  const claimAccessCode = (codeToClaim) => {
    const code = (codeToClaim || accessCodeInput).trim().toUpperCase();
    if (!code) {
      setErrorMessage('Inserisci il codice di accesso fornito dal docente.');
      return;
    }

    setErrorMessage('');
    let studentDeviceId = "";
    try {
      studentDeviceId = localStorage.getItem("teacher_service_device_id");
      if (!studentDeviceId) {
        studentDeviceId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : ("dev-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9));
        localStorage.setItem("teacher_service_device_id", studentDeviceId);
      }
    } catch {}

    fetch('/api/student/claim-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(studentDeviceId ? { 'X-Student-Device-Id': studentDeviceId } : {})
      },
      body: JSON.stringify({ accessCode: code, deviceId: studentDeviceId })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(j => { throw new Error(j.message || 'Codice non valido o scaduto'); });
        }
        return res.json();
      })
      .then(data => {
        if (data.session) {
          const cacheKey = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}-${Math.random()}`;
          sessionStorage.setItem('teacher_service_student_token', data.session.token);
          sessionStorage.setItem('teacher_service_student_cache_key', cacheKey);
          initStudentSession({ ...data.session, cacheKey });
        }
      })
      .catch(err => {
        setErrorMessage(err.message);
      });
  };

  const applyTimer = (timer) => {
    const previousExpiry = timerInfoRef.current?.expires_at || null;
    const nextExpiry = timer?.expires_at || null;
    if (previousExpiry !== nextExpiry) {
      warnedTimerRef.current.clear();
      timerExpirySyncRef.current = false;
      setTimerWarning('');
    }
    timerInfoRef.current = timer || null;
    if (!timer?.expires_at) {
      timerDeadlineRef.current = null;
      setTimerSeconds(null);
      return;
    }
    const serverNow = Date.parse(timer.server_now || new Date().toISOString());
    timerOffsetRef.current = serverNow - Date.now();
    timerDeadlineRef.current = Date.parse(timer.expires_at);
    setTimerSeconds(Math.max(0, Math.floor((timerDeadlineRef.current - serverNow) / 1000)));
  };

  const applyDraft = (draft, { localOnly = false } = {}) => {
    const restoredResponses = draft.responses || {};
    const restoredAttachments = draft.attachments || {};
    responsesRef.current = restoredResponses;
    attachmentsRef.current = restoredAttachments;
    setResponses(restoredResponses);
    setAttachments(restoredAttachments);
    if (draft.seatRow) setSeatRow(draft.seatRow);
    if (draft.seatDesk) setSeatDesk(draft.seatDesk);
    if (draft.leftNeighborId) setLeftNeighborId(draft.leftNeighborId);
    if (draft.rightNeighborId) setRightNeighborId(draft.rightNeighborId);
    const revision = Number.isInteger(draft.revision) ? draft.revision : 0;
    serverRevisionRef.current = Number.isInteger(draft.serverRevision) ? draft.serverRevision : revision;
    clientRevisionRef.current = revision;
    setPersistedRevision(Number.isInteger(draft.serverRevision) ? draft.serverRevision : revision);
    if (draft.activity) setActivityData(draft.activity);
    applyTimer(draft.timer);
    setStep('in_progress');
    setDraftLocation(localOnly ? 'local' : 'server');
    setSaveStatus(localOnly ? 'error' : 'saved');
    if (localOnly) setErrorMessage('Bozza recuperata dal dispositivo. Ricollegati per verificare e sincronizzare: non risulta ancora confermata dal server.');
  };

  const persistLocalDraft = async (overrides = {}) => {
    const activeSession = overrides.session || session;
    const assessmentId = overrides.assessmentId || activeSession?.assessmentId;
    if (!activeSession || !assessmentId) return false;
    const cacheKey = activeSession.cacheKey || sessionStorage.getItem('teacher_service_student_cache_key');
    const cached = await saveOfflineDraft({ ...activeSession, cacheKey }, assessmentId, {
      responses: overrides.responses || responsesRef.current,
      attachments: overrides.attachments || attachmentsRef.current,
      revision: Number.isInteger(overrides.revision) ? overrides.revision : clientRevisionRef.current,
      baseServerRevision: Number.isInteger(overrides.baseServerRevision) ? overrides.baseServerRevision : serverRevisionRef.current,
      seatRow: overrides.seatRow || seatRow,
      seatDesk: overrides.seatDesk || seatDesk,
      leftNeighborId: overrides.leftNeighborId ?? leftNeighborId,
      rightNeighborId: overrides.rightNeighborId ?? rightNeighborId,
      activity: overrides.activity || activityData,
      timer: overrides.timer || timerInfoRef.current
    });
    if (cached && (!isOnline || clientRevisionRef.current > serverRevisionRef.current)) setDraftLocation('local');
    return cached;
  };

  const normalizeSubmission = (sub) => {
    const restoredResponses = {};
    const restoredAttachments = {};
    for (const response of sub?.responses || []) {
      if (!response.item_id) continue;
      restoredResponses[response.item_id] = response.response_text || '';
      if (response.attachment_id) {
        restoredAttachments[response.item_id] = {
          attachmentId: response.attachment_id,
          attachmentName: response.attachment_name || 'Allegato',
          size: response.size_bytes || null,
          contentType: response.content_type || null,
          previewable: true
        };
      }
    }
    return { responses: restoredResponses, attachments: restoredAttachments };
  };

  // Initialize student session and recover server/local state without treating a cached
  // copy as authenticated or persisted. Server writes still require the live token.
  const initStudentSession = async (sess, { allowOffline = false } = {}) => {
    const cacheKey = sess.cacheKey || sessionStorage.getItem('teacher_service_student_cache_key');
    const activeSession = { ...sess, ...(cacheKey ? { cacheKey } : {}) };
    setSession(activeSession);
    setErrorMessage('');
    sessionStorage.setItem('teacher_service_student_snapshot', JSON.stringify({
      assessmentId: sess.assessmentId,
      studentId: sess.studentId,
      studentName: sess.studentName,
      classId: sess.classId,
      className: sess.className,
      activityTitle: sess.activityTitle,
      activityType: sess.activityType,
      expiresAt: sess.expiresAt
    }));

    try {
      const activityResponse = await fetch(`/api/student/activities/${sess.assessmentId}`, {
        headers: { 'X-Student-Token': sess.token }
      });
      if (!activityResponse.ok) throw new Error('Attività non disponibile sul server');
      const activityPayload = await activityResponse.json();
      const activity = activityPayload.activity;
      setActivityData(activity);
      const [neighborsResponse, submissionResponse] = await Promise.all([
        fetch(`/api/student/activities/${sess.assessmentId}/neighbors`, { headers: { 'X-Student-Token': sess.token } }).catch(() => null),
        fetch(`/api/student/activities/${sess.assessmentId}/submission`, { headers: { 'X-Student-Token': sess.token } })
      ]);
      if (neighborsResponse?.ok) {
        const neighborPayload = await neighborsResponse.json();
        if (neighborPayload.neighbors) setClassmates(neighborPayload.neighbors);
      }
      if (!submissionResponse.ok) throw new Error('Bozza non disponibile sul server');
      const submissionPayload = await submissionResponse.json();
      const sub = submissionPayload.submission;
      if (sub && (sub.attempt_status === 'submitted' || sub.status === 'submitted')) {
        isSubmittedRef.current = true;
        setSubmissionConfirmed(false);
        setSubmissionResult(sub);
        applyTimer(sub.timer);
        setDraftLocation('server');
        setStep('submitted');
        await clearOfflineDraft(activeSession, sess.assessmentId);
        sessionStorage.removeItem('teacher_service_student_token');
        sessionStorage.removeItem('teacher_service_student_snapshot');
        sessionStorage.removeItem('teacher_service_student_cache_key');
        return;
      }

      const localDraft = await loadOfflineDraft(activeSession, sess.assessmentId);
      if (sub) {
        const serverData = normalizeSubmission(sub);
        serverRevisionRef.current = sub.revision || 0;
        clientRevisionRef.current = sub.revision || 0;
        setPersistedRevision(sub.revision || 0);
        if (sub.seat_row) setSeatRow(sub.seat_row);
        if (sub.seat_desk) setSeatDesk(sub.seat_desk);
        if (sub.left_neighbor_id) setLeftNeighborId(sub.left_neighbor_id);
        if (sub.right_neighbor_id) setRightNeighborId(sub.right_neighbor_id);
        applyTimer(sub.timer);

        const localIsDirty = localDraft && localDraft.revision > localDraft.baseServerRevision;
        if (localIsDirty && localDraft.baseServerRevision !== (sub.revision || 0)) {
          setConflictState({ mode: 'restore', serverSubmission: sub, localDraft });
          setDraftLocation('conflict');
          applyDraft({ ...serverData, revision: sub.revision || 0, serverRevision: sub.revision || 0, activity, timer: sub.timer });
          setConflictState({ mode: 'restore', serverSubmission: sub, localDraft });
        } else if (localIsDirty) {
          applyDraft({ ...localDraft, activity, timer: sub.timer, serverRevision: sub.revision || 0 });
          setDraftLocation('local');
          if (navigator.onLine) setTimeout(() => triggerAutosave(localDraft.responses), 0);
        } else {
          applyDraft({ ...serverData, revision: sub.revision || 0, serverRevision: sub.revision || 0, activity, timer: sub.timer });
        }
      } else {
        serverRevisionRef.current = 0;
        clientRevisionRef.current = 0;
        setPersistedRevision(null);
        if (localDraft) {
          applyDraft({ ...localDraft, activity }, { localOnly: true });
        } else {
          setStep('seat_declaration');
        }
      }
    } catch (error) {
      const localDraft = await loadOfflineDraft(activeSession, sess.assessmentId);
      if (!allowOffline && !localDraft) {
        setErrorMessage(error.message || 'Connessione al server non disponibile');
        return;
      }
      if (!localDraft?.activity) {
        setErrorMessage('Connessione non disponibile e attività non presente nella cache locale. Riconnettiti per riprendere la prova.');
        return;
      }
      setActivityData(localDraft.activity);
      applyDraft(localDraft, { localOnly: true });
    }
  };

  // Start with a server-issued deadline and pin the first persisted revision.
  const handleStartAttempt = async (e) => {
    e.preventDefault();
    if (!session || !isOnline) return;
    const leftObj = classmates.find(c => c.id === leftNeighborId);
    const rightObj = classmates.find(c => c.id === rightNeighborId);
    const revToSend = Math.max(clientRevisionRef.current, serverRevisionRef.current) + 1;
    clientRevisionRef.current = revToSend;
    try {
      const res = await fetch(`/api/student/activities/${session.assessmentId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Student-Token': session.token },
        body: JSON.stringify({
          seatRow, seatDesk,
          leftNeighborId: leftNeighborId === 'none' ? null : leftNeighborId,
          leftNeighborName: leftObj?.fullName || 'Nessuno',
          rightNeighborId: rightNeighborId === 'none' ? null : rightNeighborId,
          rightNeighborName: rightObj?.fullName || 'Nessuno',
          responses: [], revision: revToSend
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Errore avvio prova (HTTP ${res.status})`);
      const confirmedRev = data.revision ?? revToSend;
      serverRevisionRef.current = confirmedRev;
      clientRevisionRef.current = confirmedRev;
      setPersistedRevision(confirmedRev);
      applyTimer(data.timer);
      setStep('in_progress');
      setDraftLocation('server');
      setSaveStatus('saved');
      setLastSavedTime(new Date(data.lastSavedAt || Date.now()).toLocaleTimeString());
      await persistLocalDraft({ revision: confirmedRev, baseServerRevision: confirmedRev, timer: data.timer });
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const requestServerSubmission = async () => {
    const response = await fetch(`/api/student/activities/${session.assessmentId}/submission`, {
      headers: { 'X-Student-Token': session.token }
    });
    if (!response.ok) throw new Error('Impossibile riconciliare la bozza con il server');
    return (await response.json()).submission;
  };



  const triggerAutosave = useCallback(async (currentResponses = responsesRef.current) => {
    if (!session || step !== 'in_progress' || isSubmittedRef.current || submitInFlightRef.current) return;
    const seqId = ++autosaveSeqRef.current;
    const revision = Math.max(clientRevisionRef.current, serverRevisionRef.current) + 1;
    clientRevisionRef.current = revision;
    const snapshotResponses = currentResponses || {};
    const snapshotAttachments = attachmentsRef.current;
    await persistLocalDraft({ responses: snapshotResponses, attachments: snapshotAttachments, revision });
    if (!isOnline) {
      setDraftLocation('local');
      setSaveStatus('error');
      return;
    }

    setSaveStatus('saving');
    const leftObj = classmates.find(c => c.id === leftNeighborId);
    const rightObj = classmates.find(c => c.id === rightNeighborId);
    const itemIds = new Set([...Object.keys(snapshotResponses), ...Object.keys(snapshotAttachments)]);
    const formattedResponses = [...itemIds].map(itemId => ({
      itemId,
      responseText: snapshotResponses[itemId] || '',
      attachmentId: snapshotAttachments[itemId]?.attachmentId || null
    }));
    try {
      const res = await fetch(`/api/student/activities/${session.assessmentId}/autosave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Student-Token': session.token },
        body: JSON.stringify({
          seatRow, seatDesk,
          leftNeighborId: leftNeighborId === 'none' ? null : leftNeighborId,
          leftNeighborName: leftObj?.fullName || 'Nessuno',
          rightNeighborId: rightNeighborId === 'none' ? null : rightNeighborId,
          rightNeighborName: rightObj?.fullName || 'Nessuno',
          responses: formattedResponses, revision
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        if (seqId !== autosaveSeqRef.current) return; // an older request lost the monotonic race
        const serverSubmission = await requestServerSubmission();
        if (serverSubmission?.attempt_status === 'submitted' || serverSubmission?.status === 'submitted') {
          isSubmittedRef.current = true;
          setSubmissionConfirmed(false);
          setSubmissionResult(serverSubmission);
          setStep('submitted');
          setDraftLocation('local');
          setErrorMessage('La prova risulta già conclusa sul server. La copia locale divergente è conservata su questo dispositivo; chiedi al docente di verificarla.');
          return;
        }
        setConflictState({ mode: 'autosave', serverSubmission, localDraft: {
          responses: responsesRef.current, attachments: attachmentsRef.current,
          revision: clientRevisionRef.current, baseServerRevision: serverRevisionRef.current,
          seatRow, seatDesk, leftNeighborId, rightNeighborId, activity: activityData
        } });
        setDraftLocation('conflict');
        setSaveStatus('error');
        setErrorMessage(data.message || 'La bozza sul server è cambiata. Scegli come riconciliare senza perdere risposte.');
        return;
      }
      if (!res.ok) throw new Error(data.message || `Errore salvataggio (HTTP ${res.status})`);

      const acceptedRevision = data.revision ?? revision;
      if (acceptedRevision >= serverRevisionRef.current) {
        serverRevisionRef.current = acceptedRevision;
        setPersistedRevision(acceptedRevision);
      }
      if (seqId === autosaveSeqRef.current && !isSubmittedRef.current) {
        if (clientRevisionRef.current === revision) {
          setDraftLocation('server');
          setSaveStatus('saved');
          setLastSavedTime(new Date(data.lastSavedAt || Date.now()).toLocaleTimeString());
          setErrorMessage('');
          await persistLocalDraft({ revision, baseServerRevision: revision, timer: data.timer || null });
        } else {
          setDraftLocation('local');
          setSaveStatus('saving');
          if (isOnline) setTimeout(() => triggerAutosave(responsesRef.current), 0);
        }
      }
      if (data.timer) applyTimer(data.timer);
    } catch (err) {
      if (seqId === autosaveSeqRef.current && !isSubmittedRef.current) {
        setDraftLocation('local');
        setSaveStatus('error');
        setErrorMessage(`Salvataggio non confermato dal server: ${err.message}. La bozza locale resta disponibile.`);
      }
    }
  }, [session, step, isOnline, seatRow, seatDesk, leftNeighborId, rightNeighborId, classmates, activityData]);

  const handleResponseChange = (itemId, text) => {
    if (submitInFlightRef.current || timerSeconds === 0) return;
    const updated = { ...responsesRef.current, [itemId]: text };
    responsesRef.current = updated;
    clientRevisionRef.current = Math.max(clientRevisionRef.current, serverRevisionRef.current) + 1;
    setResponses(updated);
    setDraftLocation('local');
    setSaveStatus('saving');
    persistLocalDraft({ responses: updated, revision: clientRevisionRef.current });
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => triggerAutosave(updated), 900);
  };

  // Server deadline is recalculated from server time offset; page refresh cannot extend it.
  useEffect(() => {
    if (step !== 'in_progress' || !timerDeadlineRef.current) return undefined;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((timerDeadlineRef.current - (Date.now() + timerOffsetRef.current)) / 1000));
      setTimerSeconds(remaining);
      for (const [threshold, label] of [[600, 'Restano 10 minuti.'], [300, 'Restano 5 minuti.']]) {
        if (remaining > 0 && remaining <= threshold && !warnedTimerRef.current.has(threshold)) {
          warnedTimerRef.current.add(threshold);
          setTimerWarning(label);
        }
      }
      if (remaining === 0) {
        setErrorMessage('Tempo terminato. Il server conserverà le ultime risposte sincronizzate e concluderà il tentativo.');
        if (isOnline && !timerExpirySyncRef.current && !submitInFlightRef.current) {
          timerExpirySyncRef.current = true;
          void triggerAutosave(responsesRef.current);
        }
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [step, timerDeadlineRef.current, isOnline, triggerAutosave]);

  useEffect(() => {
    const reconnected = !previousOnlineRef.current && isOnline;
    previousOnlineRef.current = isOnline;
    if (reconnected && step === 'in_progress' && !conflictState) {
      const timeout = setTimeout(() => triggerAutosave(responsesRef.current), 100);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [isOnline, step, conflictState, triggerAutosave]);

  // A reconnect re-uploads cached File/Blob values first, then sends one monotonic snapshot.
  useEffect(() => {
    if (!isOnline || step !== 'in_progress' || conflictState) return;
    const pending = Object.entries(attachmentsRef.current).filter(([, attachment]) => attachment?.pendingFile);
    if (!pending.length) return;
    (async () => {
      const next = { ...attachmentsRef.current };
      for (const [itemId, attachment] of pending) {
        const form = new FormData();
        form.append('file', attachment.pendingFile, attachment.attachmentName || 'allegato');
        form.append('assessmentId', session.assessmentId);
        form.append('itemId', itemId);
        const response = await fetch('/api/student/upload', { method: 'POST', headers: { 'X-Student-Token': session.token }, body: form });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || `Upload non riuscito (HTTP ${response.status})`);
        next[itemId] = { ...payload, pendingFile: null };
      }
      attachmentsRef.current = next;
      setAttachments(next);
      clientRevisionRef.current = Math.max(clientRevisionRef.current, serverRevisionRef.current) + 1;
      await persistLocalDraft({ attachments: next, revision: clientRevisionRef.current });
      triggerAutosave(responsesRef.current);
    })().catch(error => {
      setDraftLocation('local');
      setSaveStatus('error');
      setErrorMessage(`Riconnessione riuscita, ma un allegato non è ancora stato inviato: ${error.message}`);
    });
  }, [isOnline, step, conflictState, session, triggerAutosave]);

  const uploadAttachment = async (itemId, file) => {
    const formData = new FormData();
    formData.append('file', file, file.name || 'allegato');
    formData.append('assessmentId', session.assessmentId);
    formData.append('itemId', itemId);
    const response = await fetch('/api/student/upload', {
      method: 'POST',
      headers: { 'X-Student-Token': session.token },
      body: formData
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `Upload non riuscito (HTTP ${response.status})`);
    return { ...payload, pendingFile: null };
  };

  const handleFileUpload = async (itemId, file) => {
    if (!file || !session) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Il file supera il limite massimo di 10 MB.');
      return;
    }
    setUploadingItem(itemId);
    setErrorMessage('');
    try {
      let attachment;
      if (!isOnline) {
        attachment = {
          attachmentName: file.name,
          size: file.size,
          contentType: file.type || 'application/octet-stream',
          previewable: file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('text/'),
          pendingFile: file,
          localOnly: true
        };
      } else {
        attachment = await uploadAttachment(itemId, file);
      }
      const updated = { ...attachmentsRef.current, [itemId]: attachment };
      attachmentsRef.current = updated;
      clientRevisionRef.current = Math.max(clientRevisionRef.current, serverRevisionRef.current) + 1;
      setAttachments(updated);
      setDraftLocation(isOnline ? 'local' : 'local');
      setSaveStatus(isOnline ? 'saving' : 'error');
      await persistLocalDraft({ attachments: updated, revision: clientRevisionRef.current });
      if (isOnline) triggerAutosave(responsesRef.current);
    } catch (err) {
      setSaveStatus('error');
      setDraftLocation('local');
      setErrorMessage('Errore caricamento allegato: ' + err.message);
    } finally {
      setUploadingItem(null);
    }
  };

  const handlePreviewAttachment = async (itemId) => {
    const attachment = attachmentsRef.current[itemId];
    if (!attachment) return;
    try {
      let blob;
      if (attachment.pendingFile) {
        blob = attachment.pendingFile;
      } else {
        const url = `/api/student/attachment?assessmentId=${encodeURIComponent(session.assessmentId)}&attachmentId=${encodeURIComponent(attachment.attachmentId)}`;
        const response = await fetch(url, { headers: { 'X-Student-Token': session.token } });
        if (!response.ok) throw new Error(`Anteprima non disponibile (HTTP ${response.status})`);
        blob = await response.blob();
      }
      const type = attachment.contentType || blob.type || '';
      if (type.startsWith('text/') || /\.(txt|md|sql|js|py|json)$/i.test(attachment.attachmentName || '')) {
        setPreview({ kind: 'text', name: attachment.attachmentName, text: await blob.text() });
      } else {
        const objectUrl = URL.createObjectURL(blob);
        setPreview({ kind: type.startsWith('image/') ? 'image' : 'pdf', name: attachment.attachmentName, url: objectUrl });
      }
    } catch (error) {
      setErrorMessage(error.message);
    }
  };

  const closePreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const formatServerDraft = (submission) => {
    const normalized = normalizeSubmission(submission);
    return {
      ...normalized,
      revision: submission?.revision || 0,
      serverRevision: submission?.revision || 0,
      seatRow: submission?.seat_row || seatRow,
      seatDesk: submission?.seat_desk || seatDesk,
      leftNeighborId: submission?.left_neighbor_id || null,
      rightNeighborId: submission?.right_neighbor_id || null,
      activity: activityData,
      timer: submission?.timer || timerInfoRef.current
    };
  };

  const resolveConflict = async (keepLocal) => {
    if (!conflictState) return;
    const { mode, serverSubmission, localDraft } = conflictState;
    const serverRevision = serverSubmission?.revision || 0;
    if (!keepLocal) {
      const serverDraft = formatServerDraft(serverSubmission);
      applyDraft(serverDraft);
      serverRevisionRef.current = serverRevision;
      clientRevisionRef.current = serverRevision;
      setPersistedRevision(serverRevision);
      setConflictState(null);
      setDraftLocation('server');
      await persistLocalDraft({ ...serverDraft, revision: serverRevision, baseServerRevision: serverRevision });
      return;
    }
    serverRevisionRef.current = serverRevision;
    clientRevisionRef.current = Math.max(localDraft?.revision || 0, clientRevisionRef.current, serverRevision) + 1;
    responsesRef.current = localDraft?.responses || responsesRef.current;
    attachmentsRef.current = localDraft?.attachments || attachmentsRef.current;
    setResponses(responsesRef.current);
    setAttachments(attachmentsRef.current);
    setConflictState(null);
    setDraftLocation('local');
    await persistLocalDraft({
      ...localDraft,
      responses: responsesRef.current,
      attachments: attachmentsRef.current,
      revision: clientRevisionRef.current,
      baseServerRevision: serverRevision
    });
    if (mode === 'submit') {
      setTimeout(() => sendFinalSubmit(), 0);
    } else {
      setTimeout(() => triggerAutosave(responsesRef.current), 0);
    }
  };

  const sendFinalSubmit = async () => {
    if (!session || !isOnline || submitInFlightRef.current || isSubmittedRef.current) {
      if (!isOnline) setErrorMessage('Non puoi consegnare mentre sei offline. La bozza resta sul dispositivo finché la connessione non torna.');
      return;
    }
    if (Object.values(attachmentsRef.current).some(attachment => attachment?.pendingFile)) {
      setErrorMessage('Attendi il caricamento degli allegati prima di consegnare.');
      return;
    }
    submitInFlightRef.current = true;
    setIsSubmitting(true);
    const submitResponses = { ...responsesRef.current };
    const submitAttachments = { ...attachmentsRef.current };
    const submitResponsePayload = [...new Set([...Object.keys(submitResponses), ...Object.keys(submitAttachments)])].map(itemId => ({
      itemId,
      responseText: submitResponses[itemId] || '',
      attachmentId: submitAttachments[itemId]?.attachmentId || null
    }));
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveSeqRef.current++;
    setIsSubmitModalOpen(false);
    setSaveStatus('saving');
    const revision = Math.max(clientRevisionRef.current, serverRevisionRef.current) + 1;
    clientRevisionRef.current = revision;
    const leftObj = classmates.find(c => c.id === leftNeighborId);
    const rightObj = classmates.find(c => c.id === rightNeighborId);
    try {
      // Persist the exact submit snapshot locally before sending it.
      await persistLocalDraft({ revision, responses: submitResponses, attachments: submitAttachments });
      const res = await fetch(`/api/student/activities/${session.assessmentId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Student-Token': session.token },
        body: JSON.stringify({
          seatRow, seatDesk,
          leftNeighborId: leftNeighborId === 'none' ? null : leftNeighborId,
          leftNeighborName: leftObj?.fullName || 'Nessuno',
          rightNeighborId: rightNeighborId === 'none' ? null : rightNeighborId,
          rightNeighborName: rightObj?.fullName || 'Nessuno',
          responses: submitResponsePayload, revision
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        const serverSubmission = await requestServerSubmission();
        if (serverSubmission?.attempt_status === 'submitted' || serverSubmission?.status === 'submitted') {
          isSubmittedRef.current = true;
          setSubmissionConfirmed(false);
          setSubmissionResult(serverSubmission);
          setStep('submitted');
          setDraftLocation('local');
          setErrorMessage('Il server ha già concluso questa prova. Le eventuali modifiche locali restano conservate ma non sono state consegnate.');
          return;
        }
        const localDraft = {
          responses: responsesRef.current, attachments: attachmentsRef.current,
          revision: clientRevisionRef.current, baseServerRevision: serverRevisionRef.current,
          seatRow, seatDesk, leftNeighborId, rightNeighborId, activity: activityData
        };
        setConflictState({ mode: 'submit', serverSubmission, localDraft });
        setDraftLocation('conflict');
        setErrorMessage(data.message || 'Conflitto: confronta la versione del server con la copia locale prima di consegnare.');
        return;
      }
      if (!res.ok) throw new Error(data.message || `Consegna non riuscita (HTTP ${res.status})`);
      isSubmittedRef.current = true;
      setSubmissionConfirmed(true);
      serverRevisionRef.current = data.submission?.revision ?? revision;
      setPersistedRevision(serverRevisionRef.current);
      setSubmissionResult(data.submission);
      setDraftLocation('server');
      setStep('submitted');
      setSaveStatus('saved');
      setErrorMessage('');
      await clearOfflineDraft(session, session.assessmentId);
      sessionStorage.removeItem('teacher_service_student_token');
      sessionStorage.removeItem('teacher_service_student_snapshot');
      sessionStorage.removeItem('teacher_service_student_cache_key');
    } catch (err) {
      setDraftLocation('local');
      setSaveStatus('error');
      setErrorMessage(`Consegna non confermata dal server: ${err.message}. La copia locale non è stata eliminata.`);
    } finally {
      submitInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleFinalSubmit = () => sendFinalSubmit();

  // Logout / Switch Activity
  const handleExit = () => {
    if (step === 'in_progress') {
      const hasUnconfirmedChanges = draftLocation !== 'server' || clientRevisionRef.current > serverRevisionRef.current || !isOnline;
      const warning = hasUnconfirmedChanges
        ? 'Ci sono modifiche che potrebbero non essere state salvate sul server. Uscendo verranno rimosse da questo dispositivo e non potranno essere recuperate. Vuoi uscire comunque?'
        : 'Uscendo, la sessione temporanea verrà rimossa da questo dispositivo. Le risposte già salvate resteranno sul server; per rientrare servirà un nuovo codice dal docente. Vuoi continuare?';
      if (!confirm(warning)) return;
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveSeqRef.current++;
    if (session?.assessmentId) void clearOfflineDraft(session, session.assessmentId);
    sessionStorage.removeItem('teacher_service_student_token');
    sessionStorage.removeItem('teacher_service_student_snapshot');
    sessionStorage.removeItem('teacher_service_student_cache_key');
    isSubmittedRef.current = false;
    submitInFlightRef.current = false;
    setIsSubmitting(false);
    setConflictState(null);
    setSession(null);
    setActivityData(null);
    setResponses({});
    responsesRef.current = {};
    setAttachments({});
    attachmentsRef.current = {};
    serverRevisionRef.current = 0;
    clientRevisionRef.current = 0;
    setPersistedRevision(null);
    setDraftLocation('server');
    setSaveStatus('idle');
    setTimerSeconds(null);
    setTimerWarning('');
    setSubmissionResult(null);
    setSubmissionConfirmed(false);
    setStep('code_entry');
  };

  // Render questions count
  const totalQuestions = activityData?.items?.length || 0;
  const answeredCount = (activityData?.items || []).filter(item =>
    Boolean((responses[item.id] || '').trim()) || Boolean(attachments[item.id])
  ).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const timerLabel = timerSeconds === null ? null : `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`;

  return h('div', { className: 'student-portal-wrapper min-h-screen bg-slate-50 flex flex-col font-sans' }, [
    // Top Bar
    h('header', { key: 'nav', className: 'student-top-nav bg-white border-b px-4 py-3 sticky top-0 z-20 shadow-sm flex justify-between items-center' }, [
      h('div', { className: 'flex items-center gap-3' }, [
        h('span', { className: 'text-2xl cursor-pointer', onClick: handleExit }, '🎓'),
        h('div', null, [
          h('h1', { className: 'font-bold text-sm text-slate-900 leading-tight' }, session ? session.activityTitle : 'Area Studenti — Teacher Service'),
          session ? h('span', { className: 'text-xs text-slate-500' }, `${session.studentName} • ${session.className}`) : h('span', { className: 'text-xs text-slate-400' }, 'Verifiche ed Esercitazioni Digitali')
        ])
      ]),

      // Save status & Actions
      h('div', { className: 'flex items-center gap-3' }, [
        step === 'in_progress' && h('div', { className: 'flex items-center gap-2 text-xs' }, [
          saveStatus === 'saving' && draftLocation === 'local' && h('span', { className: 'student-status-badge student-status-local', role: 'status' }, 'Modifiche in attesa di sincronizzazione'),
          saveStatus === 'saving' && draftLocation !== 'local' && h('span', { className: 'student-status-badge student-status-saving', role: 'status' }, '⏳ Salvataggio sul server...'),
          saveStatus === 'saved' && draftLocation === 'server' && h('span', { className: 'badge bg-emerald-100 text-emerald-800 px-2 py-1 rounded', role: 'status' }, `✓ Salvato ${persistedRevision !== null ? `(Rev ${persistedRevision})` : ''} • ${lastSavedTime || ''}`),
          draftLocation === 'local' && h('span', { className: 'badge bg-amber-100 text-amber-900 px-2 py-1 rounded', role: 'status' }, 'Solo su questo dispositivo'),
          draftLocation === 'conflict' && h('span', { className: 'badge bg-rose-100 text-rose-900 px-2 py-1 rounded', role: 'alert' }, 'Bozze in conflitto'),
          saveStatus === 'error' && h('button', {
            type: 'button',
            className: 'badge bg-rose-100 text-rose-800 px-2 py-1 rounded font-semibold cursor-pointer border border-rose-300',
            onClick: () => triggerAutosave(responses)
          }, '⚠️ Errore salvataggio (Riprova ora)')
        ]),

        !isOnline && h('span', { className: 'badge bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded font-bold' }, '⚡ Offline'),

        session && h('button', {
          type: 'button',
          className: 'btn btn-secondary btn-sm text-xs',
          onClick: handleExit
        }, 'Esci')
      ])
    ]),

    // Global Error Banner
    errorMessage && h('div', { key: 'err', className: 'bg-rose-50 border-b border-rose-200 px-4 py-3 text-rose-800 text-sm flex justify-between items-center' }, [
      h('span', null, errorMessage),
      h('button', { className: 'font-bold text-xs underline', onClick: () => setErrorMessage('') }, 'Chiudi')
    ]),

    // Main Content Container
    h('main', { key: 'main', className: 'flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6' }, [

      // STEP 1: Code Entry Screen
      step === 'code_entry' && h('div', { className: 'card max-w-md mx-auto p-6 sm:p-8 text-center bg-white rounded-xl shadow-sm border mt-8' }, [
        h('span', { className: 'text-4xl mb-4 block' }, '🔑'),
        h('h2', { className: 'text-xl font-bold text-slate-900 mb-2' }, 'Accesso Prova Studente'),
        h('p', { className: 'text-sm text-slate-600 mb-6' }, 'Inserisci il codice di 6 caratteri assegnato dal docente per iniziare la tua prova in aula.'),

        h('form', { onSubmit: e => { e.preventDefault(); claimAccessCode(); } }, [
          h('div', { className: 'mb-4' }, [
            h('input', {
              type: 'text',
              className: 'form-input w-full text-center text-3xl font-mono font-bold tracking-widest uppercase py-3 border-2 border-indigo-200 focus:border-indigo-600 rounded-lg',
              maxLength: 6,
              placeholder: 'A3F9X2',
              autoFocus: true,
              value: accessCodeInput,
              onChange: e => setAccessCodeInput(e.target.value.toUpperCase())
            })
          ]),
          h('button', {
            type: 'submit',
            className: 'btn btn-primary w-full py-3 text-base font-semibold shadow',
            disabled: accessCodeInput.trim().length === 0
          }, 'Accedi alla Prova →')
        ]),

        h('div', { className: 'mt-8 pt-6 border-t text-xs text-slate-500' }, [
          h('p', null, 'Accesso leggero senza password conformemente alle normative scolastiche (Dossier 02 §4).')
        ])
      ]),

      // STEP 2: Seat Map Declaration (Dossier 05)
      step === 'seat_declaration' && h('div', { className: 'card max-w-lg mx-auto p-6 bg-white rounded-xl shadow-sm border mt-4' }, [
        h('div', { className: 'text-center mb-6' }, [
          h('span', { className: 'text-3xl mb-2 block' }, '🪑'),
          h('h2', { className: 'text-xl font-bold text-slate-900' }, 'Dichiarazione Postazione d\'Aula'),
          h('p', { className: 'text-xs text-slate-500 mt-1' }, `Benvenuto/a, ${session?.studentName}! Prima di iniziare, indica la tua posizione e i compagni adiacenti.`)
        ]),

        h('form', { onSubmit: handleStartAttempt, className: 'space-y-4' }, [
          h('div', { className: 'grid grid-cols-2 gap-3' }, [
            h('div', null, [
              h('label', { className: 'form-label text-xs font-semibold' }, 'Fila:'),
              h('select', {
                className: 'form-select w-full text-sm',
                value: seatRow,
                onChange: e => setSeatRow(e.target.value)
              }, ['Fila 1', 'Fila 2', 'Fila 3', 'Fila 4', 'Fila 5', 'Fila 6'].map(r => h('option', { key: r, value: r }, r)))
            ]),
            h('div', null, [
              h('label', { className: 'form-label text-xs font-semibold' }, 'Banco / Postazione:'),
              h('select', {
                className: 'form-select w-full text-sm',
                value: seatDesk,
                onChange: e => setSeatDesk(e.target.value)
              }, ['Banco 1', 'Banco 2', 'Banco 3', 'Banco 4', 'Banco 5', 'Banco 6', 'Banco 7', 'Banco 8'].map(b => h('option', { key: b, value: b }, b)))
            ])
          ]),

          h('div', { className: 'pt-2 border-t' }, [
            h('label', { className: 'form-label text-xs font-semibold' }, 'Vicino di Banco a Sinistra:'),
            h('select', {
              className: 'form-select w-full text-sm',
              value: leftNeighborId,
              onChange: e => setLeftNeighborId(e.target.value)
            }, classmates.map(c => h('option', { key: c.id, value: c.id }, c.fullName)))
          ]),

          h('div', null, [
            h('label', { className: 'form-label text-xs font-semibold' }, 'Vicino di Banco a Destra:'),
            h('select', {
              className: 'form-select w-full text-sm',
              value: rightNeighborId,
              onChange: e => setRightNeighborId(e.target.value)
            }, classmates.map(c => h('option', { key: c.id, value: c.id }, c.fullName)))
          ]),

          h('div', { className: 'pt-4' }, [
            h('button', {
              type: 'submit',
              className: 'btn btn-primary w-full py-3 text-base font-semibold shadow'
            }, 'Conferma Postazione e Inizia Prova →')
          ])
        ])
      ]),

      // STEP 3: In Progress Attempt (Questions, Autosave, Mobile Editor)
      step === 'in_progress' && activityData && h('div', { className: 'space-y-6 pb-20' }, [
        // Activity Metadata Banner
        h('div', { className: 'bg-white p-4 rounded-xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3' }, [
          h('div', null, [
            h('div', { className: 'flex items-center gap-2' }, [
              h('span', { className: 'badge badge-primary text-xs' }, activityData.activity_type === 'exercise' ? 'Esercitazione' : 'Verifica'),
              h('span', { className: 'text-xs text-slate-500 font-medium' }, `Durata: ${activityData.duration_minutes || 60} min`),
              h('span', { className: 'text-xs text-slate-500 font-medium' }, `Punteggio Max: ${activityData.max_score} pt`),
              timerLabel && h('span', { className: `student-timer-pill ${timerSeconds <= 300 ? 'student-timer-urgent' : timerSeconds <= 600 ? 'student-timer-warning' : 'student-timer-normal'}`, role: 'timer', 'aria-live': 'polite' }, `Tempo ${timerLabel}`)
            ]),
            activityData.description && h('p', { className: 'text-xs text-slate-600 mt-1' }, activityData.description)
          ]),
          h('div', { className: 'text-right shrink-0' }, [
            h('span', { className: 'text-xs font-semibold text-slate-700 block' }, `Risposte: ${answeredCount} su ${totalQuestions}`),
            h('div', { className: 'w-32 bg-slate-100 rounded-full h-2 mt-1 overflow-hidden' }, [
              h('div', {
                className: 'bg-indigo-600 h-2 rounded-full transition-all duration-300',
                style: { width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }
              })
            ])
          ])
        ]),

        timerWarning && h('div', { className: 'timer-warning', role: 'alert' }, [
          h('span', null, timerWarning),
          h('button', { type: 'button', onClick: () => setTimerWarning(''), 'aria-label': 'Chiudi avviso' }, '×')
        ]),

        h('nav', { className: 'question-navigation', 'aria-label': 'Navigazione quesiti' }, [
          h('button', { type: 'button', className: 'btn btn-secondary', disabled: questionIndex <= 0, onClick: () => setQuestionIndex(i => Math.max(0, i - 1)) }, '← Precedente'),
          h('div', { className: 'question-dots' }, (activityData.items || []).map((item, idx) => h('button', {
            key: item.id,
            type: 'button',
            className: `question-dot ${idx === questionIndex ? 'is-current' : ''} ${((responses[item.id] || '').trim() || attachments[item.id]) ? 'is-answered' : ''}`,
            onClick: () => setQuestionIndex(idx),
            'aria-label': `Vai al quesito ${idx + 1}${((responses[item.id] || '').trim() || attachments[item.id]) ? ', risposta presente' : ', senza risposta'}`,
            'aria-current': idx === questionIndex ? 'step' : undefined
          }, String(idx + 1)))),
          h('span', { className: 'question-position' }, `Quesito ${Math.min(questionIndex + 1, Math.max(totalQuestions, 1))} di ${totalQuestions}`),
          h('button', { type: 'button', className: 'btn btn-secondary', disabled: questionIndex >= totalQuestions - 1, onClick: () => setQuestionIndex(i => Math.min(totalQuestions - 1, i + 1)) }, 'Successivo →')
        ]),

        // One question at a time keeps the student workspace usable on narrow viewports.
        h('div', { className: 'space-y-6' }, (activityData.items || []).map((item, idx) => {
          if (idx !== questionIndex) return null;
          const resp = responses[item.id] || '';
          const attach = attachments[item.id];

          return h('div', { key: item.id, className: 'card student-question-card p-5 bg-white rounded-xl border shadow-sm space-y-3' }, [
            h('div', { className: 'flex justify-between items-start gap-2' }, [
              h('div', { className: 'flex items-center gap-2' }, [
                h('span', { className: 'font-bold text-base text-indigo-700' }, `Quesito ${idx + 1}`),
                h('span', { className: 'badge badge-neutral text-xs' }, `${item.max_score} pt`)
              ]),
              item.is_self_correcting ? h('span', { className: 'text-xs text-emerald-600 font-semibold' }, '⚡ Autocorreggibile') : null
            ]),

            h('div', { className: 'text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap' }, item.question_text),

            // MCQ Options
            item.type === 'multiple_choice' && item.options && h('div', { className: 'space-y-2 pt-2' },
              item.options.map(opt => {
                const isSelected = resp === opt.id || resp === opt.text;
                return h('label', {
                  key: opt.id,
                  className: `flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-50 border-indigo-400 font-semibold text-indigo-900' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`
                }, [
                  h('input', {
                    type: 'radio',
                    name: `mcq_${item.id}`,
                    value: opt.id,
                    checked: isSelected,
                    disabled: isSubmitting || timerSeconds === 0,
                    onChange: () => handleResponseChange(item.id, opt.id)
                  }),
                  h('span', { className: 'font-bold text-xs text-slate-500 w-4' }, `${opt.id})`),
                  h('span', { className: 'flex-1' }, opt.text)
                ]);
              })
            ),

            // Open Question Textarea
            (item.type === 'open_question' || item.type === 'open_short' || item.type === 'open_extended') && h('div', { className: 'pt-2' }, [
              h('textarea', {
                className: 'form-textarea w-full text-sm p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 leading-relaxed',
                rows: 4,
                placeholder: 'Scrivi qui la tua risposta argomentata...',
                value: resp,
                disabled: isSubmitting || timerSeconds === 0,
                onChange: e => handleResponseChange(item.id, e.target.value)
              })
            ]),

            // Code Editor
            item.type === 'code' && h('div', { className: 'pt-2 space-y-2' }, [
              h('div', { className: 'mobile-code-editor-container' }, [
                h('div', { className: 'mobile-code-toolbar' }, [
                  h('span', { className: 'text-xs text-slate-200 font-semibold mr-auto' }, `Editor • ${item.language || 'testo'}`),
                  h('span', { className: 'text-xs text-slate-400' }, 'Tab inserisce 2 spazi')
                ]),
                h('div', { className: 'mobile-code-editor-body' }, [
                  h('div', { className: 'mobile-code-gutter', 'aria-hidden': 'true' },
                    Array.from({ length: Math.max(8, (resp || item.starter_code || '').split('\n').length) }, (_, line) => h('div', { key: line }, String(line + 1)))
                  ),
                  h('textarea', {
                    className: 'mobile-code-textarea',
                    rows: 8,
                    spellCheck: false,
                    autoCapitalize: 'off',
                    autoCorrect: 'off',
                    autoComplete: 'off',
                    'aria-label': `Codice per quesito ${idx + 1}`,
                    placeholder: item.starter_code || '# Scrivi il tuo codice qui...',
                    value: resp,
                    disabled: isSubmitting || timerSeconds === 0,
                    onChange: e => handleResponseChange(item.id, e.target.value),
                    onKeyDown: e => {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const start = e.target.selectionStart;
                        const end = e.target.selectionEnd;
                        const nextVal = e.target.value.slice(0, start) + '  ' + e.target.value.slice(end);
                        handleResponseChange(item.id, nextVal);
                        requestAnimationFrame(() => e.target.setSelectionRange(start + 2, start + 2));
                      } else if (e.key === 'Enter') {
                        const before = e.target.value.slice(0, e.target.selectionStart);
                        const indent = before.split('\n').pop().match(/^\s*/)?.[0] || '';
                        if (indent) {
                          e.preventDefault();
                          const start = e.target.selectionStart;
                          const nextVal = e.target.value.slice(0, start) + `\n${indent}` + e.target.value.slice(e.target.selectionEnd);
                          handleResponseChange(item.id, nextVal);
                          requestAnimationFrame(() => e.target.setSelectionRange(start + indent.length + 1, start + indent.length + 1));
                        }
                      }
                    }
                  })
                ])
              ])
            ]),

            // Attachment Upload
            item.type === 'attachment' && h('div', { className: 'pt-2 border-t space-y-2' }, [
              h('label', { className: 'form-label text-xs font-semibold block mb-1' }, 'Allegato richiesto (max 10 MB):'),
              attach ? (
                h('div', { className: 'flex items-center justify-between p-2 bg-slate-100 rounded border text-xs' }, [
                  h('span', { className: 'font-semibold text-slate-700 truncate' }, `📎 ${attach.attachmentName}${attach.localOnly ? ' • solo locale' : ''}`),
                  h('div', { className: 'flex items-center gap-3 shrink-0' }, [
                    h('button', { type: 'button', className: 'text-indigo-700 hover:underline', onClick: () => handlePreviewAttachment(item.id) }, 'Anteprima'),
                    h('button', {
                    type: 'button',
                    disabled: isSubmitting,
                    className: 'text-rose-600 hover:underline ml-2',
                    onClick: () => {
                      const updated = { ...attachments };
                      delete updated[item.id];
                      attachmentsRef.current = updated;
                      clientRevisionRef.current = Math.max(clientRevisionRef.current, serverRevisionRef.current) + 1;
                      setAttachments(updated);
                      setDraftLocation('local');
                      persistLocalDraft({ attachments: updated, revision: clientRevisionRef.current });
                      triggerAutosave(responsesRef.current);
                    }
                  }, 'Rimuovi')
                  ])
                ])
              ) : (
                h('input', {
                  type: 'file',
                  accept: '.pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.sql,.js,.py,.json',
                  disabled: uploadingItem === item.id || timerSeconds === 0 || isSubmitting,
                  className: 'text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-indigo-50 file:text-indigo-700',
                  onChange: e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(item.id, e.target.files[0]);
                    }
                  }
                })
              ),
              uploadingItem === item.id && h('span', { className: 'text-xs text-indigo-700', role: 'status' }, 'Caricamento allegato…')
            ])
          ]);
        })),

        // Bottom Sticky Action Bar
        h('div', { className: 'fixed bottom-0 left-0 right-0 bg-white border-t p-3 sm:p-4 z-20 shadow-lg' }, [
          h('div', { className: 'max-w-4xl mx-auto flex justify-between items-center gap-4' }, [
            h('div', { className: 'text-xs text-slate-500 hidden sm:block' }, [
              h('span', null, `Autosalvataggio attivo: ${answeredCount}/${totalQuestions} risposte compilate`)
            ]),
            h('div', { className: 'flex items-center gap-3 w-full sm:w-auto justify-end' }, [
              h('button', {
                type: 'button',
                className: 'btn btn-secondary btn-sm',
                onClick: () => triggerAutosave(responsesRef.current),
                disabled: !isOnline || timerSeconds === 0
              }, '💾 Salva Ora'),
              h('button', {
                type: 'button',
                className: 'btn btn-primary font-bold shadow px-6',
                onClick: () => setIsSubmitModalOpen(true),
                disabled: submitInFlightRef.current || Boolean(uploadingItem)
              }, uploadingItem ? 'Attendi il caricamento…' : '🏁 Consegna Definitiva Prova')
            ])
          ])
        ])
      ]),

      // STEP 4: Submitted Immutable Screen
      step === 'submitted' && h('div', { className: 'card max-w-lg mx-auto p-8 text-center bg-white rounded-xl shadow-sm border mt-8' }, [
        h('span', { className: 'text-5xl mb-4 block' }, '🎉'),
        h('h2', { className: 'text-2xl font-bold text-slate-900 mb-2' }, submissionConfirmed ? 'Prova Consegnata con Successo!' : 'Prova conclusa sul server'),
        h('p', { className: 'text-sm text-slate-600 mb-6' }, submissionConfirmed ? 'La tua consegna è stata sigillata e salvata definitivamente sul server del docente.' : 'Il server segnala che il tentativo è concluso. Questa schermata non conferma eventuali modifiche rimaste solo su questo dispositivo.'),

        h('div', { className: 'bg-slate-50 p-4 rounded-lg border text-left text-xs space-y-2 mb-6' }, [
          h('div', { className: 'flex justify-between' }, [
            h('span', { className: 'text-slate-500' }, 'Studente:'),
            h('span', { className: 'font-semibold' }, session?.studentName)
          ]),
          h('div', { className: 'flex justify-between' }, [
            h('span', { className: 'text-slate-500' }, 'Attività:'),
            h('span', { className: 'font-semibold' }, session?.activityTitle)
          ]),
          h('div', { className: 'flex justify-between' }, [
            h('span', { className: 'text-slate-500' }, 'Data e ora consegna:'),
            h('span', { className: 'font-semibold' }, new Date(submissionResult?.submitted_at || Date.now()).toLocaleString())
          ]),
          h('div', { className: 'flex justify-between' }, [
            h('span', { className: 'text-slate-500' }, 'Stato tentativo:'),
            h('span', { className: 'badge badge-success' }, submissionConfirmed ? 'Consegnata (Immutabile)' : 'Conclusa / da verificare con il docente')
          ])
        ]),

        h('p', { className: 'text-xs text-slate-400 mb-6' }, 'Non sono consentite ulteriori modifiche alle risposte fornite, salvo eventuale riapertura espressamente autorizzata dal docente d\'aula.'),

        h('button', {
          type: 'button',
          className: 'btn btn-secondary',
          onClick: handleExit
        }, 'Torna alla Schermata Iniziale')
      ])
    ]),

    // Modal Confirmation for Final Submission
    isSubmitModalOpen && h('div', { className: 'modal-overlay' }, [
      h('div', { className: 'modal-dialog max-w-md' }, [
        h('div', { className: 'modal-header' }, [
          h('h3', { className: 'modal-title font-bold text-lg' }, 'Conferma Consegna Definitiva')
        ]),
        h('div', { className: 'modal-body p-4 space-y-3 text-sm' }, [
          h('p', null, `Hai risposto a ${answeredCount} su ${totalQuestions} quesiti.`),
          h('div', { className: 'review-stats-grid' }, [
            h('div', { className: 'review-stat-box' }, [h('div', { className: 'review-stat-val' }, String(answeredCount)), h('div', { className: 'review-stat-lbl' }, 'Risposte presenti')]),
            h('div', { className: 'review-stat-box' }, [h('div', { className: 'review-stat-val' }, String(unansweredCount)), h('div', { className: 'review-stat-lbl' }, 'Senza risposta')]),
            h('div', { className: 'review-stat-box' }, [h('div', { className: 'review-stat-val' }, String(Object.keys(attachments).length)), h('div', { className: 'review-stat-lbl' }, 'Allegati')])
          ]),
          h('div', { className: 'review-questions-list' }, (activityData?.items || []).map((item, idx) => h('button', {
            type: 'button', key: item.id, className: 'review-question-row',
            onClick: () => { setQuestionIndex(idx); setIsSubmitModalOpen(false); }
          }, [h('span', null, `Quesito ${idx + 1}`), h('span', { className: 'font-semibold' }, attachments[item.id] ? `📎 ${attachments[item.id].attachmentName}` : (responses[item.id]?.trim() ? 'Risposta presente' : 'Senza risposta'))]))),
          answeredCount < totalQuestions && h('div', { className: 'p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs' }, [
            h('strong', null, 'Attenzione: '),
            `Ci sono ancora ${totalQuestions - answeredCount} domande lasciate in bianco. Sei sicuro di voler procedere comunque?`
          ]),
          h('p', { className: 'text-xs text-slate-500 leading-relaxed' }, 'Una volta confermata la consegna, la prova sarà sigillata e non sarà più possibile modificare le risposte o caricare ulteriori file.')
        ]),
        h('div', { className: 'modal-footer p-3 border-t flex justify-end gap-2' }, [
          h('button', {
            type: 'button',
            className: 'btn btn-secondary',
            onClick: () => setIsSubmitModalOpen(false)
          }, 'Continua a Lavorare'),
          h('button', {
            type: 'button',
            className: 'btn btn-primary font-bold',
            onClick: handleFinalSubmit,
            disabled: !isOnline || submitInFlightRef.current || Boolean(uploadingItem) || draftLocation === 'conflict'
          }, !isOnline ? 'Ricollegati per consegnare' : uploadingItem ? 'Attendi il caricamento' : isSubmitting ? 'Consegna in corso…' : 'Conferma e Consegna')
        ])
      ])
    ]),

    conflictState && h('div', { className: 'review-modal-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'conflict-title' }, [
      h('div', { className: 'review-modal-card' }, [
        h('div', { className: 'review-modal-header' }, h('h2', { id: 'conflict-title', className: 'font-bold text-lg' }, 'Riconcilia le due bozze')),
        h('div', { className: 'review-modal-body space-y-3 text-sm' }, [
          h('p', null, `Il server ha la revisione ${conflictState.serverSubmission?.revision || 0}; questo dispositivo conserva modifiche non confermate. Nessuna delle due copie verrà sovrascritta senza la tua scelta.`),
          h('p', { className: 'text-xs text-slate-600' }, conflictState.mode === 'submit' ? 'Se mantieni la copia locale, verrà inviata nuovamente come consegna definitiva dopo il riallineamento.' : 'Se mantieni la copia locale, verrà sincronizzata dopo il riallineamento.')
        ]),
        h('div', { className: 'review-modal-footer' }, [
          h('button', { type: 'button', className: 'btn btn-secondary', onClick: () => resolveConflict(false) }, 'Usa versione server'),
          h('button', { type: 'button', className: 'btn btn-primary', onClick: () => resolveConflict(true) }, 'Mantieni le mie modifiche')
        ])
      ])
    ]),

    preview && h('div', { className: 'review-modal-backdrop', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Anteprima ${preview.name || 'allegato'}`, onClick: closePreview }, [
      h('div', { className: 'preview-modal-content', onClick: e => e.stopPropagation() }, [
        h('div', { className: 'review-modal-header' }, [h('strong', null, preview.name), h('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: closePreview }, 'Chiudi anteprima')]),
        h('div', { className: 'preview-media-container' }, [
          preview.kind === 'image' && h('img', { src: preview.url, alt: preview.name || 'Allegato', className: 'preview-media-image' }),
          preview.kind === 'pdf' && h('iframe', { src: preview.url, title: preview.name || 'Anteprima PDF', className: 'attachment-pdf-frame', sandbox: '' }),
          preview.kind === 'text' && h('pre', { className: 'preview-media-code' }, preview.text)
        ])
      ])
    ])
  ]);
}
