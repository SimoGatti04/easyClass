import React, { createElement as h, useEffect, useMemo, useRef, useState } from 'react';

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Richiesta non riuscita (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function formatDate(value) {
  if (!value) return 'Nessun salvataggio confermato';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data non disponibile' : date.toLocaleString();
}

function StatusBadge({ student }) {
  const labels = {
    not_started: ['Non iniziato', 'badge-neutral'],
    in_progress: ['In corso', 'badge-warning'],
    submitted: ['Consegnato', 'badge-success'],
    graded: ['Valutato', 'badge-info'],
    withdrawn: ['Ritirato dal docente', 'badge-danger']
  };
  const [label, className] = labels[student.status] || [student.status, 'badge-neutral'];
  return h('span', { className: `badge ${className}` }, label);
}

export function LiveMonitoringView({ initialAssessmentId, onOpenSubmission }) {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(initialAssessmentId || '');
  const [monitorData, setMonitorData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [viewMode, setViewMode] = useState('seatmap');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [error, setError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [extraMinutes, setExtraMinutes] = useState('15');
  const [reopenMinutes, setReopenMinutes] = useState('15');
  const [actionReason, setActionReason] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [busyAction, setBusyAction] = useState(false);
  const [announcements, setAnnouncements] = useState([]);

  const pollTimerRef = useRef(null);
  const pollInFlightRef = useRef(false);
  const previousRosterRef = useRef(null);
  const announcedKeysRef = useRef(new Set());
  const idempotencyKeysRef = useRef(new Map());

  useEffect(() => {
    let current = true;
    requestJson('/api/classes')
      .then(async data => {
        if (!current) return;
        const nextClasses = data.classes || [];
        setClasses(nextClasses);
        if (!nextClasses.length) return;
        if (initialAssessmentId) {
          try {
            const { assessment } = await requestJson(`/api/assessments/${encodeURIComponent(initialAssessmentId)}`);
            const assessmentClass = nextClasses.find(item => item.id === assessment.class_id);
            if (current && assessmentClass) {
              setSelectedClassId(assessmentClass.id);
              setSelectedAssessmentId(initialAssessmentId);
              return;
            }
          } catch { /* Fall back to the first available class and its activities. */ }
        }
        if (current) setSelectedClassId(nextClasses[0].id);
      })
      .catch(err => { if (current) setError(`Errore caricamento classi: ${err.message}`); });
    return () => { current = false; };
  }, [initialAssessmentId]);

  useEffect(() => {
    if (!selectedClassId) return undefined;
    let current = true;
    requestJson(`/api/assessments?classId=${encodeURIComponent(selectedClassId)}`)
      .then(data => {
        if (!current) return;
        const next = data.assessments || [];
        setAssessments(next);
        if (initialAssessmentId && next.some(item => item.id === initialAssessmentId)) {
          setSelectedAssessmentId(initialAssessmentId);
        } else if (!next.some(item => item.id === selectedAssessmentId)) {
          setSelectedAssessmentId(next[0]?.id || '');
          if (!next.length) setMonitorData(null);
        }
      })
      .catch(err => { if (current) setError(`Errore caricamento attività: ${err.message}`); });
    return () => { current = false; };
  }, [selectedClassId, initialAssessmentId]);

  const fetchLiveData = async (assessmentId, background = false) => {
    if (!assessmentId || pollInFlightRef.current) return;
    pollInFlightRef.current = true;
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const payload = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/live-monitor`);
      const live = payload.liveMonitoring || payload;
      if (assessmentId !== selectedAssessmentId) return;
      const nextRoster = live.students || [];
      const previous = previousRosterRef.current;
      if (previous && previous.assessmentId === assessmentId) {
        const newSubmissions = nextRoster.filter(student => {
          const before = previous.bySubmission.get(student.submissionId);
          const wasActive = before?.status === 'in_progress';
          const isSubmitted = student.status === 'submitted' || student.status === 'graded';
          const key = `${assessmentId}:${student.submissionId}:${student.submittedAt || student.status}`;
          if (!student.submissionId || !wasActive || !isSubmitted || announcedKeysRef.current.has(key)) return false;
          announcedKeysRef.current.add(key);
          return true;
        });
        if (newSubmissions.length) {
          setAnnouncements(current => [
            ...newSubmissions.map(student => ({
              id: `${student.submissionId}:${student.submittedAt || Date.now()}`,
              name: student.fullName,
              submittedAt: student.submittedAt
            })),
            ...current
          ].slice(0, 4));
        }
      }
      previousRosterRef.current = {
        assessmentId,
        bySubmission: new Map(nextRoster.filter(student => student.submissionId).map(student => [student.submissionId, student]))
      };
      setMonitorData(live);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError(`Errore monitoraggio: ${err.message}`);
    } finally {
      pollInFlightRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    previousRosterRef.current = null;
    announcedKeysRef.current.clear();
    setAnnouncements([]);
    setSelectedStudentId('');
    if (selectedAssessmentId) fetchLiveData(selectedAssessmentId, false);
    else setMonitorData(null);
  }, [selectedAssessmentId]);

  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (autoRefresh && selectedAssessmentId) {
      pollTimerRef.current = setInterval(() => fetchLiveData(selectedAssessmentId, true), 10000);
    }
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, [autoRefresh, selectedAssessmentId]);

  const students = monitorData?.students || [];
  const metrics = monitorData?.summary || monitorData?.metrics || {};
  const selectedStudent = students.find(student => student.studentId === selectedStudentId) || null;
  const rowMap = useMemo(() => {
    const rows = new Map(['Fila 1', 'Fila 2', 'Fila 3', 'Fila 4', 'Fila 5', 'Fila 6'].map(row => [row, []]));
    for (const student of students) {
      if (!student.seatRow) continue;
      if (!rows.has(student.seatRow)) rows.set(student.seatRow, []);
      rows.get(student.seatRow).push(student);
    }
    for (const row of rows.values()) row.sort((a, b) => String(a.seatDesk || '').localeCompare(String(b.seatDesk || ''), undefined, { numeric: true }));
    return rows;
  }, [students]);

  const openStudent = (student) => {
    setSelectedStudentId(student.studentId);
    setActionReason('');
    setActionError('');
    setActionMessage('');
    setPendingAction(null);
    setExtraMinutes('15');
    setReopenMinutes(student.timerExpired ? '15' : '0');
  };

  const requestActionConfirmation = (type, student, { minutes: requestedMinutes, defaultReason = '' } = {}) => {
    if (!student.submissionId) {
      setActionError('Lo studente non ha ancora un tentativo da gestire.');
      return;
    }
    const reason = actionReason.trim() || defaultReason;
    if (!reason) {
      setActionError('Inserisci una motivazione: sarà conservata nello storico delle operazioni docente.');
      return;
    }
    const minutes = requestedMinutes ?? Number(type === 'extra-time' ? extraMinutes : reopenMinutes);
    if ((type === 'extra-time' && (!Number.isInteger(minutes) || minutes <= 0)) ||
        (type === 'reopen' && (!Number.isInteger(minutes) || minutes < 0))) {
      setActionError(type === 'extra-time' ? 'Indica minuti aggiuntivi interi e maggiori di zero.' : 'Indica zero o più minuti interi per il nuovo timer.');
      return;
    }
    setActionError('');
    setPendingAction({ type, studentId: student.studentId, submissionId: student.submissionId, minutes, reason });
  };

  const confirmAction = async () => {
    if (!pendingAction || busyAction) return;
    const action = pendingAction;
    const keyParts = [action.type, action.submissionId, action.minutes, action.reason].join(':');
    if (!idempotencyKeysRef.current.has(keyParts)) idempotencyKeysRef.current.set(keyParts, crypto.randomUUID());
    const idempotencyKey = idempotencyKeysRef.current.get(keyParts);
    setBusyAction(true);
    setActionError('');
    try {
      if (action.type === 'extra-time') {
        await requestJson(`/api/assessments/${encodeURIComponent(selectedAssessmentId)}/submissions/${encodeURIComponent(action.studentId)}/extra-time`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extraMinutes: action.minutes, reason: action.reason, idempotencyKey })
        });
        setActionMessage(`Aggiunti ${action.minutes} minuti a ${selectedStudent?.fullName || 'lo studente'}.`);
      } else if (action.type === 'withdraw') {
        await requestJson(`/api/submissions/${encodeURIComponent(action.submissionId)}/withdraw`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: action.reason, idempotencyKey })
        });
        setActionMessage('Tentativo ritirato dal docente. Le risposte già salvate sono state conservate.');
      } else {
        await requestJson(`/api/assessments/${encodeURIComponent(selectedAssessmentId)}/submissions/${encodeURIComponent(action.submissionId)}/reopen`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: action.reason, extraMinutes: action.minutes, idempotencyKey })
        });
        setActionMessage('Tentativo riaperto. Lo studente può continuare con il tempo autorizzato.');
      }
      idempotencyKeysRef.current.delete(keyParts);
      setPendingAction(null);
      setActionReason('');
      await fetchLiveData(selectedAssessmentId, true);
    } catch (err) {
      setActionError(`${err.message}${err.status === 409 ? ' I dati sono stati aggiornati; controlla lo stato prima di riprovare.' : ' Se la connessione è incerta, riprova la stessa operazione senza modificarne i parametri.'}`);
      if (err.status === 409) await fetchLiveData(selectedAssessmentId, true);
    } finally {
      setBusyAction(false);
    }
  };

  const statusText = (student) => {
    if (student.status === 'not_started') return 'Non è ancora entrato';
    if (student.status === 'in_progress') return `${student.answeredCount} risposte salvate su ${student.totalItems}`;
    if (student.status === 'withdrawn') return 'Tentativo terminato dal docente';
    if (student.status === 'graded') return `Valutato${student.finalGrade ? ` · ${student.finalGrade}` : ''}`;
    return 'Consegna ricevuta';
  };

  const renderStudentCard = (student, mode = 'roster') => h('article', {
    key: student.studentId,
    className: `monitor-student-card monitor-status-${student.status}`,
    'data-student-id': student.studentId
  }, [
    h('div', { className: 'monitor-student-main' }, [
      h('div', { className: 'monitor-student-identity' }, [
        h('strong', null, student.fullName),
        h(StatusBadge, { student }),
        h('span', { className: 'monitor-student-progress' }, statusText(student))
      ]),
      mode === 'seat' && h('div', { className: 'monitor-seat-meta' }, `Postazione ${student.seatDesk || '—'}`)
    ]),
    h('div', { className: 'monitor-student-details' }, [
      h('span', null, `Salvataggio server: ${formatDate(student.lastSavedAt)}`),
      student.timerExpired && h('span', { className: 'monitor-warning' }, 'Timer scaduto: verifica la situazione con lo studente.')
    ]),
    h('div', { className: 'monitor-student-actions' }, [
      student.submissionId && onOpenSubmission && h('button', {
        type: 'button', className: 'btn btn-sm btn-secondary',
        onClick: () => onOpenSubmission(selectedAssessmentId, student.submissionId)
      }, student.status === 'graded' ? 'Apri correzione' : 'Apri consegna'),
      h('button', { type: 'button', className: 'btn btn-sm btn-ghost', onClick: () => openStudent(student) }, 'Dettagli e azioni')
    ])
  ]);

  return h('div', { className: 'live-monitoring-view c5-monitoring' }, [
    h('section', { key: 'heading', className: 'teacher-page-heading' }, [
      h('div', null, [
        h('span', { className: 'eyebrow' }, 'Verifiche · in diretta'),
        h('h2', null, 'Monitoraggio della classe'),
        h('p', { className: 'text-muted' }, 'Risposte e orari mostrati qui sono quelli confermati dal server. L’assenza di aggiornamenti non indica inattività.')
      ]),
      h('div', { className: 'monitor-live-indicator', role: 'status' }, [
        h('span', { className: `pulsing-dot${autoRefresh ? '' : ' is-paused'}` }),
        autoRefresh ? 'Aggiornamento ogni 10 secondi' : 'Aggiornamento automatico in pausa'
      ])
    ]),
    h('section', { key: 'controls', className: 'card c5-monitor-controls' }, [
      h('label', { className: 'form-group' }, [
        h('span', { className: 'field-label' }, 'Classe'),
        h('select', { className: 'select-input', value: selectedClassId, onChange: event => setSelectedClassId(event.target.value) },
          classes.map(item => h('option', { key: item.id, value: item.id }, `${item.name} · ${item.academic_year}`)))
      ]),
      h('label', { className: 'form-group' }, [
        h('span', { className: 'field-label' }, 'Attività'),
        h('select', { className: 'select-input', value: selectedAssessmentId, onChange: event => setSelectedAssessmentId(event.target.value), disabled: !assessments.length },
          assessments.map(item => h('option', { key: item.id, value: item.id }, `${item.title} · ${item.status}`)))
      ]),
      h('div', { className: 'c5-monitor-actions' }, [
        h('label', { className: 'auto-refresh-label' }, [
          h('input', { type: 'checkbox', checked: autoRefresh, onChange: event => setAutoRefresh(event.target.checked) }), 'Aggiornamento live'
        ]),
        h('button', { type: 'button', className: 'btn btn-secondary', disabled: loading || refreshing || !selectedAssessmentId, onClick: () => fetchLiveData(selectedAssessmentId, true) }, refreshing ? 'Aggiornamento…' : 'Aggiorna ora')
      ])
    ]),
    error && h('div', { key: 'error', className: 'alert alert-danger', role: 'alert' }, error),
    actionMessage && h('div', { key: 'action-message', className: 'alert alert-success', role: 'status' }, actionMessage),
    announcements.length > 0 && h('section', { key: 'announcements', className: 'card c5-submission-announcements', 'aria-label': 'Nuove consegne' }, [
      h('div', { className: 'c5-section-heading' }, [h('div', null, [h('span', { className: 'eyebrow' }, 'Aggiornamenti'), h('h3', null, 'Nuove consegne')]), h('button', { type: 'button', className: 'btn btn-sm btn-ghost', onClick: () => setAnnouncements([]) }, 'Nascondi')]),
      announcements.map(item => h('div', { key: item.id, className: 'c5-announcement-row' }, [
        h('strong', null, item.name), h('span', null, `Consegna ricevuta · ${formatDate(item.submittedAt)}`)
      ]))
    ]),
    loading && !monitorData && h('div', { key: 'loading', className: 'empty-state' }, 'Caricamento dei dati della classe…'),
    !loading && !monitorData && selectedAssessmentId && h('div', { key: 'empty', className: 'empty-state' }, 'Nessun dato di monitoraggio disponibile.'),
    monitorData && h(React.Fragment, { key: selectedAssessmentId }, [
      h('section', { className: 'card c5-assessment-context' }, [
        h('div', null, [h('span', { className: 'eyebrow' }, monitorData.assessment?.activityType === 'exercise' ? 'Esercitazione' : 'Verifica'), h('h3', null, monitorData.assessment?.title || 'Attività selezionata')]),
        h('div', { className: 'c5-context-meta' }, [`${monitorData.assessment?.itemCount || 0} quesiti`, `${monitorData.assessment?.durationMinutes || '—'} min`, `Stato: ${monitorData.assessment?.status || '—'}`, lastUpdated ? `Aggiornato ${lastUpdated.toLocaleTimeString()}` : 'In attesa del primo aggiornamento'])
      ]),
      h('section', { className: 'metrics-cards-grid c5-monitor-metrics' }, [
        ['Totale classe', metrics.totalStudents ?? students.length],
        ['Non ancora entrati', metrics.notStarted ?? 0],
        ['In corso', metrics.inProgress ?? 0],
        ['Consegne ricevute', metrics.submitted ?? 0],
        ['Valutati', metrics.graded ?? 0],
        ['Ritirati dal docente', metrics.withdrawn ?? 0]
      ].map(([label, value]) => h('article', { className: 'metric-card', key: label }, [h('strong', { className: 'metric-value' }, String(value)), h('span', { className: 'metric-label' }, label)]))),
      h('section', { className: 'c5-monitor-roster-section' }, [
        h('div', { className: 'c5-section-heading' }, [
          h('div', null, [h('span', { className: 'eyebrow' }, 'Presenze e avanzamento'), h('h3', null, 'Classe')]),
          h('div', { className: 'mode-switch-buttons', role: 'group', 'aria-label': 'Vista monitoraggio' }, [
            h('button', { type: 'button', className: viewMode === 'seatmap' ? 'active' : '', onClick: () => setViewMode('seatmap') }, 'Postazioni'),
            h('button', { type: 'button', className: viewMode === 'roster' ? 'active' : '', onClick: () => setViewMode('roster') }, 'Elenco')
          ])
        ]),
        viewMode === 'seatmap'
          ? h('div', { className: 'c5-seatmap' }, [
              ...[...rowMap.entries()].filter(([, rowStudents]) => rowStudents.length).map(([row, rowStudents]) => h('section', { className: 'c5-seat-row', key: row }, [
                h('h4', null, row),
                h('div', { className: 'c5-seat-grid' }, rowStudents.map(student => h('div', { key: student.studentId, className: 'c5-seat-cell' }, renderStudentCard(student, 'seat'))))
              ])),
              students.some(student => !student.seatRow) && h('section', { className: 'c5-unseated-roster' }, [h('h4', null, 'Postazione non dichiarata'), h('div', { className: 'c5-roster-list' }, students.filter(student => !student.seatRow).map(student => renderStudentCard(student)))])
            ])
          : h('div', { className: 'c5-roster-list' }, students.map(student => renderStudentCard(student)))
      ]),
      metrics.expiredInProgress > 0 && h('aside', { className: 'alert alert-warning', role: 'status' }, `${metrics.expiredInProgress} tentativi in corso hanno raggiunto il termine previsto. Verifica con la persona interessata; il dato non implica inattività.`)
    ]),
    selectedStudent && h('div', { key: 'student-detail', className: 'modal-overlay c5-detail-overlay', role: 'presentation' }, [
      h('section', { className: 'modal-dialog c5-student-detail', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'monitor-detail-title' }, [
        h('div', { className: 'modal-header' }, [
          h('div', null, [h('span', { className: 'eyebrow' }, 'Dettaglio tentativo'), h('h3', { id: 'monitor-detail-title', className: 'modal-title' }, `Dettaglio tentativo · ${selectedStudent.fullName}`)]),
          h('button', { type: 'button', className: 'btn btn-sm btn-ghost', onClick: () => setSelectedStudentId(''), 'aria-label': 'Chiudi dettagli' }, '×')
        ]),
        h('div', { className: 'modal-body c5-detail-body' }, [
          h('div', { className: 'c5-detail-status' }, [h(StatusBadge, { student: selectedStudent }), h('span', null, statusText(selectedStudent))]),
          h('div', { className: 'detail-grid' }, [
            ['Postazione', selectedStudent.seatRow ? `${selectedStudent.seatRow}, ${selectedStudent.seatDesk || '—'}` : 'Non dichiarata'],
            ['Risposte salvate', `${selectedStudent.answeredCount} su ${selectedStudent.totalItems}`],
            ['Ultimo salvataggio confermato', formatDate(selectedStudent.lastSavedAt)],
            ['Ultima chiusura registrata', formatDate(selectedStudent.submittedAt)],
            ['Tempo aggiuntivo', `${selectedStudent.extraTimeMinutes || 0} min`],
            ['Timer', selectedStudent.timerExpired ? 'Termine raggiunto' : 'Nessun termine raggiunto'],
            ['Studente a sinistra', selectedStudent.leftNeighborName || 'Nessuno'],
            ['Studente a destra', selectedStudent.rightNeighborName || 'Nessuno']
          ].map(([label, value]) => h('div', { className: 'detail-item', key: label }, [h('span', { className: 'detail-label' }, label), h('strong', { className: 'detail-value' }, value)]))),
          actionError && h('div', { className: 'alert alert-danger', role: 'alert' }, actionError),
          actionMessage && h('div', { className: 'alert alert-success', role: 'status' }, actionMessage),
          ['in_progress'].includes(selectedStudent.status) && monitorData.assessment?.status === 'active' && h('section', { className: 'c5-teacher-actions' }, [
            h('h4', null, 'Operazioni durante la prova'),
            h('div', { className: 'c5-extra-time-controls' }, [
              h('button', { type: 'button', className: 'btn btn-secondary', disabled: busyAction, onClick: () => requestActionConfirmation('extra-time', selectedStudent, { minutes: 5, defaultReason: 'Concessione rapida di 5 minuti da parte del docente' }) }, 'Concedi +5 min (rapido)'),
              h('label', { className: 'form-group' }, [h('span', { className: 'field-label' }, 'Minuti extra personalizzati'), h('input', { type: 'number', min: 1, step: 1, className: 'select-input', value: extraMinutes, onChange: event => setExtraMinutes(event.target.value) })]),
              h('button', { type: 'button', className: 'btn btn-secondary', disabled: busyAction, onClick: () => requestActionConfirmation('extra-time', selectedStudent) }, 'Concedi tempo extra')
            ]),
            h('label', { className: 'form-group mt-3' }, [h('span', { className: 'field-label' }, 'Motivazione operazione docente'), h('textarea', { rows: 2, className: 'text-input', value: actionReason, onChange: event => setActionReason(event.target.value), placeholder: 'Es. richiesta concordata per problema tecnico' })]),
            h('button', { type: 'button', className: 'btn btn-danger', disabled: busyAction, onClick: () => requestActionConfirmation('withdraw', selectedStudent) }, 'Ritira tentativo e conserva risposte')
          ]),
          ['submitted', 'graded', 'withdrawn'].includes(selectedStudent.status) && monitorData.assessment?.status === 'active' && h('section', { className: 'c5-teacher-actions' }, [
            h('h4', null, 'Riapertura del tentativo'),
            h('label', { className: 'form-group' }, [h('span', { className: 'field-label' }, 'Minuti aggiuntivi per la riapertura'), h('input', { type: 'number', min: 0, step: 1, className: 'select-input', value: reopenMinutes, onChange: event => setReopenMinutes(event.target.value) })]),
            h('label', { className: 'form-group' }, [h('span', { className: 'field-label' }, 'Motivazione riapertura'), h('textarea', { rows: 2, className: 'text-input', value: actionReason, onChange: event => setActionReason(event.target.value), placeholder: 'Spiega la ragione della riapertura' })]),
            h('button', { type: 'button', className: 'btn btn-warning', disabled: busyAction, onClick: () => requestActionConfirmation('reopen', selectedStudent) }, 'Richiedi riapertura')
          ]),
          pendingAction && h('div', { className: 'c5-action-confirmation', role: 'alertdialog', 'aria-label': 'Conferma operazione docente' }, [
            h('p', null, pendingAction.type === 'extra-time'
              ? `Confermi ${pendingAction.minutes} minuti aggiuntivi per ${selectedStudent.fullName}?`
              : pendingAction.type === 'withdraw'
                ? `Confermi il ritiro del tentativo di ${selectedStudent.fullName}? Le risposte già salvate resteranno disponibili.`
                : `Confermi la riapertura del tentativo di ${selectedStudent.fullName} con ${pendingAction.minutes} minuti aggiuntivi?`),
            h('p', { className: 'text-muted text-sm' }, `Motivazione registrata: ${pendingAction.reason}`),
            h('div', { className: 'action-confirmation-buttons' }, [
              h('button', { type: 'button', className: 'btn btn-secondary', disabled: busyAction, onClick: () => setPendingAction(null) }, 'Annulla'),
              h('button', { type: 'button', className: 'btn btn-primary', disabled: busyAction, onClick: confirmAction }, busyAction ? 'Salvataggio…' : 'Conferma operazione')
            ])
          ]),
          selectedStudent.submissionId && onOpenSubmission && h('button', { type: 'button', className: 'btn btn-primary c5-open-correction', onClick: () => onOpenSubmission(selectedAssessmentId, selectedStudent.submissionId) }, 'Apri la consegna e correggi')
        ]),
        h('div', { className: 'modal-footer' }, [h('button', { type: 'button', className: 'btn btn-secondary', onClick: () => setSelectedStudentId('') }, 'Chiudi dettagli')])
      ])
    ])
  ]);
}
