import React, { createElement as h, useState, useEffect, useRef, useCallback } from 'react';

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

  // Autosave and concurrency state
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const autosaveTimerRef = useRef(null);
  const autosaveSeqRef = useRef(0);
  const isSubmittedRef = useRef(false);
  const activeAutosaveAbortRef = useRef(null);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setSaveStatus('error');
      setErrorMessage('Connessione persa. Le risposte sono memorizzate nel browser; non chiudere la finestra.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 1. Check URL parameters for direct access code or restore existing session
  useEffect(() => {
    // Check URL search or hash for code
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
    const codeFromUrl = urlParams.get('code') || hashParams.get('code');

    if (codeFromUrl) {
      setAccessCodeInput(codeFromUrl.toUpperCase());
      claimAccessCode(codeFromUrl.toUpperCase());
      return;
    }

    // Check stored session in sessionStorage
    const storedToken = sessionStorage.getItem('teacher_service_student_token');
    if (storedToken) {
      fetch('/api/student/session', {
        headers: { 'X-Student-Token': storedToken }
      })
        .then(res => res.ok ? res.json() : Promise.reject(new Error('Sessione scaduta o non valida')))
        .then(data => {
          if (data.session) {
            initStudentSession(data.session);
          }
        })
        .catch(() => {
          sessionStorage.removeItem('teacher_service_student_token');
        });
    }


  }, []);

  // Claim access code
  const claimAccessCode = (codeToClaim) => {
    const code = (codeToClaim || accessCodeInput).trim().toUpperCase();
    if (!code) {
      setErrorMessage('Inserisci il codice di accesso fornito dal docente.');
      return;
    }

    setErrorMessage('');
    fetch('/api/student/claim-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessCode: code })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(j => { throw new Error(j.message || 'Codice non valido o scaduto'); });
        }
        return res.json();
      })
      .then(data => {
        if (data.session) {
          sessionStorage.setItem('teacher_service_student_token', data.session.token);
          initStudentSession(data.session);
        }
      })
      .catch(err => {
        setErrorMessage(err.message);
      });
  };

  // Initialize student session & load questions / previous draft
  const initStudentSession = (sess) => {
    setSession(sess);
    setErrorMessage('');

    // Fetch activity questions
    fetch(`/api/student/activities/${sess.assessmentId}`, {
      headers: { 'X-Student-Token': sess.token }
    })
      .then(res => {
        if (!res.ok) throw new Error('Attività non trovata o non ancora avviata');
        return res.json();
      })
      .then(data => {
        setActivityData(data.activity);

        // Fetch classmates for Seat Map
        fetch(`/api/student/activities/${sess.assessmentId}/neighbors`, {
          headers: { 'X-Student-Token': sess.token }
        })
          .then(r => r.json())
          .then(nData => {
            if (nData.neighbors) setClassmates(nData.neighbors);
          })
          .catch(() => {});

        // Fetch existing draft if any
        return fetch(`/api/student/activities/${sess.assessmentId}/submission`, {
          headers: { 'X-Student-Token': sess.token }
        })
          .then(r => r.json())
          .then(subData => {
            if (subData.submission) {
              const sub = subData.submission;
              if (sub.attempt_status === 'submitted' || sub.status === 'submitted') {
                isSubmittedRef.current = true;
                setSubmissionResult(sub);
                setStep('submitted');
                return;
              }

              // Restore in-progress draft
              if (sub.seat_row) setSeatRow(sub.seat_row);
              if (sub.seat_desk) setSeatDesk(sub.seat_desk);
              if (sub.left_neighbor_id) setLeftNeighborId(sub.left_neighbor_id);
              if (sub.right_neighbor_id) setRightNeighborId(sub.right_neighbor_id);

              const initialResp = {};
              const initialAttach = {};
              if (Array.isArray(sub.responses)) {
                sub.responses.forEach(r => {
                  if (r.item_id) {
                    initialResp[r.item_id] = r.response_text || '';
                    if (r.attachment_path) {
                      initialAttach[r.item_id] = {
                        attachmentPath: r.attachment_path,
                        attachmentName: r.attachment_name || 'Allegato'
                      };
                    }
                  }
                });
              }
              setResponses(initialResp);
              setAttachments(initialAttach);
              setLastSavedTime(new Date(sub.last_saved_at || Date.now()).toLocaleTimeString());
              setStep('in_progress');
              setSaveStatus('saved');
            } else {
              // No existing attempt -> go to seat declaration
              setStep('seat_declaration');
            }
          });
      })
      .catch(err => {
        setErrorMessage(err.message);
      });
  };

  // Start attempt with Seat Map
  const handleStartAttempt = (e) => {
    e.preventDefault();
    if (!session) return;

    const leftObj = classmates.find(c => c.id === leftNeighborId);
    const rightObj = classmates.find(c => c.id === rightNeighborId);

    fetch(`/api/student/activities/${session.assessmentId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Student-Token': session.token
      },
      body: JSON.stringify({
        seatRow,
        seatDesk,
        leftNeighborId: leftNeighborId === 'none' ? null : leftNeighborId,
        leftNeighborName: leftObj?.fullName || 'Nessuno',
        rightNeighborId: rightNeighborId === 'none' ? null : rightNeighborId,
        rightNeighborName: rightObj?.fullName || 'Nessuno',
        responses: []
      })
    })
      .then(res => {
        if (!res.ok) return res.json().then(j => { throw new Error(j.message || 'Errore avvio prova'); });
        return res.json();
      })
      .then(() => {
        setStep('in_progress');
        setSaveStatus('saved');
        setLastSavedTime(new Date().toLocaleTimeString());
      })
      .catch(err => setErrorMessage(err.message));
  };

  // Autosave trigger with concurrency protection & HTTP verification
  const triggerAutosave = useCallback((currentResponses) => {
    if (!session || step !== 'in_progress' || isSubmittedRef.current) return;

    if (activeAutosaveAbortRef.current) {
      activeAutosaveAbortRef.current.abort();
    }
    const abortController = new AbortController();
    activeAutosaveAbortRef.current = abortController;

    const seqId = ++autosaveSeqRef.current;
    setSaveStatus('saving');

    const formattedResponses = Object.entries(currentResponses).map(([itemId, text]) => ({
      itemId,
      responseText: text,
      attachmentPath: attachments[itemId]?.attachmentPath || null,
      attachmentName: attachments[itemId]?.attachmentName || null
    }));

    const leftObj = classmates.find(c => c.id === leftNeighborId);
    const rightObj = classmates.find(c => c.id === rightNeighborId);

    fetch(`/api/student/activities/${session.assessmentId}/autosave`, {
      method: 'POST',
      signal: abortController.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Student-Token': session.token
      },
      body: JSON.stringify({
        seatRow,
        seatDesk,
        leftNeighborId: leftNeighborId === 'none' ? null : leftNeighborId,
        leftNeighborName: leftObj?.fullName || 'Nessuno',
        rightNeighborId: rightNeighborId === 'none' ? null : rightNeighborId,
        rightNeighborName: rightObj?.fullName || 'Nessuno',
        responses: formattedResponses
      })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(j => { throw new Error(j.message || `Errore salvataggio (HTTP ${res.status})`); });
        }
        return res.json();
      })
      .then(data => {
        // Discard older out-of-order response
        if (seqId === autosaveSeqRef.current && !isSubmittedRef.current) {
          setSaveStatus('saved');
          setLastSavedTime(new Date(data.lastSavedAt || Date.now()).toLocaleTimeString());
          setErrorMessage('');
        }
      })
      .catch(err => {
        if (err.name === 'AbortError' || abortController.signal.aborted) {
          return;
        }
        if (seqId === autosaveSeqRef.current && !isSubmittedRef.current) {
          setSaveStatus('error');
          setErrorMessage('Salvataggio automatico non riuscito: ' + err.message);
        }
      });
  }, [session, step, seatRow, seatDesk, leftNeighborId, rightNeighborId, classmates, attachments]);

  // Handle student input change and queue debounced autosave
  const handleResponseChange = (itemId, text) => {
    const updated = { ...responses, [itemId]: text };
    setResponses(updated);
    setSaveStatus('saving');

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      triggerAutosave(updated);
    }, 1200);
  };

  // Periodic autosave fallback (every 25 seconds)
  useEffect(() => {
    if (step !== 'in_progress') return;
    const interval = setInterval(() => {
      triggerAutosave(responses);
    }, 25000);
    return () => clearInterval(interval);
  }, [step, responses, triggerAutosave]);

  // Handle file attachment upload
  const handleFileUpload = (itemId, file) => {
    if (!file || !session) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Il file supera il limite massimo di 10 MB.');
      return;
    }

    setSaveStatus('saving');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assessmentId', session.assessmentId);

    fetch('/api/student/upload', {
      method: 'POST',
      headers: { 'X-Student-Token': session.token },
      body: formData
    })
      .then(res => {
        if (!res.ok) return res.json().then(j => { throw new Error(j.message || 'Errore upload'); });
        return res.json();
      })
      .then(data => {
        const updatedAttach = {
          ...attachments,
          [itemId]: {
            attachmentPath: data.attachmentPath,
            attachmentName: data.attachmentName,
            size: data.size
          }
        };
        setAttachments(updatedAttach);
        // Trigger autosave with new attachment
        triggerAutosave(responses);
      })
      .catch(err => {
        setSaveStatus('error');
        setErrorMessage('Errore caricamento allegato: ' + err.message);
      });
  };

  // Final submission
  const handleFinalSubmit = () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (activeAutosaveAbortRef.current) {
      activeAutosaveAbortRef.current.abort();
      activeAutosaveAbortRef.current = null;
    }
    autosaveSeqRef.current++;
    isSubmittedRef.current = true;
    setIsSubmitModalOpen(false);
    setSaveStatus('saving');

    const formattedResponses = Object.entries(responses).map(([itemId, text]) => ({
      itemId,
      responseText: text,
      attachmentPath: attachments[itemId]?.attachmentPath || null,
      attachmentName: attachments[itemId]?.attachmentName || null
    }));

    const leftObj = classmates.find(c => c.id === leftNeighborId);
    const rightObj = classmates.find(c => c.id === rightNeighborId);

    fetch(`/api/student/activities/${session.assessmentId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Student-Token': session.token
      },
      body: JSON.stringify({
        seatRow,
        seatDesk,
        leftNeighborId: leftNeighborId === 'none' ? null : leftNeighborId,
        leftNeighborName: leftObj?.fullName || 'Nessuno',
        rightNeighborId: rightNeighborId === 'none' ? null : rightNeighborId,
        rightNeighborName: rightObj?.fullName || 'Nessuno',
        responses: formattedResponses
      })
    })
      .then(res => {
        if (!res.ok) return res.json().then(j => { throw new Error(j.message || 'Errore consegna definitiva'); });
        return res.json();
      })
      .then(data => {
        isSubmittedRef.current = true;
        setSubmissionResult(data.submission);
        setStep('submitted');
        setSaveStatus('saved');
      })
      .catch(err => {
        isSubmittedRef.current = false;
        setSaveStatus('error');
        setErrorMessage('Errore durante la consegna: ' + err.message);
      });
  };

  // Logout / Switch Activity
  const handleExit = () => {
    if (step === 'in_progress' && !confirm('Sei sicuro di voler uscire? Le risposte salvate sono al sicuro sul server del docente.')) {
      return;
    }
    sessionStorage.removeItem('teacher_service_student_token');
    setSession(null);
    setActivityData(null);
    setResponses({});
    setAttachments({});
    setStep('code_entry');
  };

  // Render questions count
  const totalQuestions = activityData?.items?.length || 0;
  const answeredCount = Object.values(responses).filter(v => typeof v === 'string' && v.trim().length > 0).length;

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
          saveStatus === 'saving' && h('span', { className: 'badge bg-blue-100 text-blue-800 animate-pulse px-2 py-1 rounded' }, '⏳ Salvataggio...'),
          saveStatus === 'saved' && h('span', { className: 'badge bg-emerald-100 text-emerald-800 px-2 py-1 rounded' }, `✓ Salvato ${lastSavedTime || ''}`),
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
              h('span', { className: 'text-xs text-slate-500 font-medium' }, `Punteggio Max: ${activityData.max_score} pt`)
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

        // Questions List
        h('div', { className: 'space-y-6' }, (activityData.items || []).map((item, idx) => {
          const resp = responses[item.id] || '';
          const attach = attachments[item.id];

          return h('div', { key: item.id, className: 'card p-5 bg-white rounded-xl border shadow-sm space-y-3' }, [
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
                onChange: e => handleResponseChange(item.id, e.target.value)
              })
            ]),

            // Code Editor
            item.type === 'code' && h('div', { className: 'pt-2 space-y-2' }, [
              h('div', { className: 'flex justify-between items-center text-xs text-slate-500' }, [
                h('span', null, `Linguaggio: ${item.language || 'Testo'}`),
                h('span', null, 'Usa Tab o Spazio per indentare')
              ]),
              h('textarea', {
                className: 'form-textarea w-full font-mono text-xs p-3 bg-slate-900 text-slate-100 rounded-lg leading-relaxed focus:ring-2 focus:ring-indigo-500',
                rows: 8,
                placeholder: item.starter_code || '# Scrivi il tuo codice qui...',
                value: resp || (item.starter_code && !responses[item.id] ? item.starter_code : resp),
                onChange: e => handleResponseChange(item.id, e.target.value),
                onKeyDown: e => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = e.target.selectionStart;
                    const end = e.target.selectionEnd;
                    const val = e.target.value;
                    const nextVal = val.substring(0, start) + '  ' + val.substring(end);
                    handleResponseChange(item.id, nextVal);
                  }
                }
              })
            ]),

            // Attachment Upload
            (item.type === 'attachment' || item.allow_attachment) && h('div', { className: 'pt-2 border-t' }, [
              h('label', { className: 'form-label text-xs font-semibold block mb-1' }, 'Allegato richiesto (max 10MB):'),
              attach ? (
                h('div', { className: 'flex items-center justify-between p-2 bg-slate-100 rounded border text-xs' }, [
                  h('span', { className: 'font-semibold text-slate-700 truncate' }, `📎 ${attach.attachmentName}`),
                  h('button', {
                    type: 'button',
                    className: 'text-rose-600 hover:underline ml-2',
                    onClick: () => {
                      const updated = { ...attachments };
                      delete updated[item.id];
                      setAttachments(updated);
                      triggerAutosave(responses);
                    }
                  }, 'Rimuovi')
                ])
              ) : (
                h('input', {
                  type: 'file',
                  className: 'text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-indigo-50 file:text-indigo-700',
                  onChange: e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(item.id, e.target.files[0]);
                    }
                  }
                })
              )
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
                onClick: () => triggerAutosave(responses)
              }, '💾 Salva Ora'),
              h('button', {
                type: 'button',
                className: 'btn btn-primary font-bold shadow px-6',
                onClick: () => setIsSubmitModalOpen(true)
              }, '🏁 Consegna Definitiva Prova')
            ])
          ])
        ])
      ]),

      // STEP 4: Submitted Immutable Screen
      step === 'submitted' && h('div', { className: 'card max-w-lg mx-auto p-8 text-center bg-white rounded-xl shadow-sm border mt-8' }, [
        h('span', { className: 'text-5xl mb-4 block' }, '🎉'),
        h('h2', { className: 'text-2xl font-bold text-slate-900 mb-2' }, 'Prova Consegnata con Successo!'),
        h('p', { className: 'text-sm text-slate-600 mb-6' }, 'La tua consegna è stata sigillata e salvata definitivamente sul server del docente.'),

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
            h('span', { className: 'badge badge-success' }, 'Consegnata (Immutabile)')
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
            onClick: handleFinalSubmit
          }, 'Conferma e Consegna')
        ])
      ])
    ])
  ]);
}
