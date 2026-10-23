import React, { createElement as h, useEffect, useMemo, useRef, useState } from 'react';

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Richiesta non riuscita (${response.status})`);
  return data;
}

function bestEvaluation(evaluations = [], itemId) {
  return evaluations.filter(item => item.item_id === itemId).sort((a, b) => {
    const aManual = a.evaluation_type === 'manual_teacher' ? 1 : 0;
    const bManual = b.evaluation_type === 'manual_teacher' ? 1 : 0;
    return bManual - aManual || b.evaluation_round - a.evaluation_round || String(b.created_at).localeCompare(String(a.created_at));
  })[0] || null;
}

function currentEvaluationLabel(type) {
  if (type === 'manual_teacher') return 'Correzione docente';
  if (type === 'deterministic') return 'Proposta deterministica';
  if (type === 'ai_assisted') return 'Proposta AI';
  return 'Da valutare';
}

export function SubmissionsView({ initialAssessmentId, initialSubmissionId, initialStatusFilter = 'pending' }) {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(initialAssessmentId || '');
  const [assessmentDetail, setAssessmentDetail] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [correctionMode, setCorrectionMode] = useState('student');
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [itemDrafts, setItemDrafts] = useState({});
  const [finalGradeInput, setFinalGradeInput] = useState('');
  const [teacherNotesInput, setTeacherNotesInput] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [questionResponses, setQuestionResponses] = useState([]);
  const [questionDrafts, setQuestionDrafts] = useState({});
  const [questionLoading, setQuestionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questionRefreshToken, setQuestionRefreshToken] = useState(0);
  const [aiProposalAuthorized, setAiProposalAuthorized] = useState(false);
  const [proposalBusy, setProposalBusy] = useState(false);
  const savingRef = useRef(false);
  const reviewKeysRef = useRef(new Map());

  const visibleSubmissions = useMemo(() => submissions.filter(submission =>
    statusFilter === 'reviewed'
      ? submission.status === 'reviewed' && Boolean(submission.final_grade)
      : submission.status !== 'reviewed' || !submission.final_grade
  ), [submissions, statusFilter]);

  useEffect(() => {
    let current = true;
    async function loadClasses() {
      try {
        const data = await requestJson('/api/classes');
        const nextClasses = data.classes || [];
        if (!current) return;
        setClasses(nextClasses);
        if (initialAssessmentId) {
          try {
            const { assessment } = await requestJson(`/api/assessments/${encodeURIComponent(initialAssessmentId)}`);
            if (current) setSelectedClassId(assessment.class_id || nextClasses[0]?.id || '');
          } catch {
            if (current) setSelectedClassId(nextClasses[0]?.id || '');
          }
        } else {
          setSelectedClassId(nextClasses[0]?.id || '');
        }
      } catch (err) {
        if (current) setError(`Errore caricamento classi: ${err.message}`);
      }
    }
    loadClasses();
    return () => { current = false; };
  }, [initialAssessmentId]);

  useEffect(() => {
    if (!selectedClassId) return;
    let current = true;
    requestJson(`/api/assessments?classId=${encodeURIComponent(selectedClassId)}`)
      .then(data => {
        if (!current) return;
        const next = data.assessments || [];
        setAssessments(next);
        if (initialAssessmentId && next.some(item => item.id === initialAssessmentId)) {
          setSelectedAssessmentId(initialAssessmentId);
        } else if (!selectedAssessmentId || !next.some(item => item.id === selectedAssessmentId)) {
          setSelectedAssessmentId(next[0]?.id || '');
        }
      })
      .catch(err => { if (current) setError(`Errore caricamento attività: ${err.message}`); });
    return () => { current = false; };
  }, [selectedClassId, initialAssessmentId]);

  const loadAssessmentWorkspace = async (assessmentId = selectedAssessmentId) => {
    if (!assessmentId) return;
    setLoading(true);
    setError('');
    try {
      const [assessmentResult, submissionResult, statsResult] = await Promise.all([
        requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}`),
        requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/submissions`),
        requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/statistics`)
      ]);
      setAssessmentDetail(assessmentResult.assessment);
      setSubmissions(submissionResult.submissions || []);
      setStatistics(statsResult.statistics || null);
      setSelectedItemId(previous => previous || assessmentResult.assessment.items?.[0]?.id || '');
    } catch (err) {
      setError(`Impossibile caricare le consegne: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAssessmentId) loadAssessmentWorkspace(selectedAssessmentId);
    else {
      setSubmissions([]);
      setAssessmentDetail(null);
      setStatistics(null);
    }
  }, [selectedAssessmentId]);

  useEffect(() => {
    if (initialStatusFilter) setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  const openSubmissionDetail = async (submissionId) => {
    setError('');
    try {
      const { submission } = await requestJson(`/api/submissions/${encodeURIComponent(submissionId)}`);
      setActiveSubmission(submission);
      setFinalGradeInput(submission.final_grade || submission.proposed_grade || '');
      setTeacherNotesInput(submission.teacher_notes || '');
      const drafts = {};
      for (const item of assessmentDetail?.items || []) {
        const evaluation = bestEvaluation(submission.evaluations, item.id);
        const response = submission.responses.find(answer => answer.item_id === item.id);
        drafts[item.id] = {
          score: evaluation ? String(evaluation.score) : '',
          feedback: evaluation?.feedback || '',
          notes: evaluation?.teacher_notes || '',
          responseText: response?.response_text || '',
          attachmentName: response?.attachment_name || ''
        };
      }
      setItemDrafts(drafts);
    } catch (err) {
      setError(`Impossibile aprire la consegna: ${err.message}`);
    }
  };

  useEffect(() => {
    if (!initialSubmissionId || !selectedAssessmentId || submissions.length === 0) return;
    if (submissions.some(submission => submission.id === initialSubmissionId)) openSubmissionDetail(initialSubmissionId);
  }, [initialSubmissionId, selectedAssessmentId, submissions.length]);

  useEffect(() => {
    if (correctionMode !== 'question' || !selectedAssessmentId || !selectedItemId) return;
    let current = true;
    setQuestionLoading(true);
    requestJson(`/api/assessments/${encodeURIComponent(selectedAssessmentId)}/items/${encodeURIComponent(selectedItemId)}/responses`)
      .then(data => {
        if (!current) return;
        const responses = data.submissions || [];
        setQuestionResponses(responses);
        setQuestionDrafts(Object.fromEntries(responses.map(row => [row.submission_id || row.student_id, {
          score: row.current_score === null || row.current_score === undefined ? '' : String(row.current_score),
          feedback: row.current_feedback || '',
          notes: row.current_teacher_notes || '',
          responseText: row.response_text || ''
        }])));
      })
      .catch(err => { if (current) setError(`Impossibile caricare le risposte al quesito: ${err.message}`); })
      .finally(() => { if (current) setQuestionLoading(false); });
    return () => { current = false; };
  }, [correctionMode, selectedAssessmentId, selectedItemId, submissions.length, questionRefreshToken]);

  const makeOverrides = (drafts, items) => items.flatMap(item => {
    const draft = drafts[item.id];
    if (!draft || draft.score === '' || draft.score === null || draft.score === undefined) return [];
    const score = Number(draft.score);
    if (!Number.isFinite(score)) throw new Error(`Inserisci un punteggio valido per il quesito ${item.order_index || ''}`);
    return [{ itemId: item.id, score, feedback: draft.feedback || '', notes: draft.notes || '' }];
  });

  const saveReview = async ({ submissionId, overrides, finalize, finalGrade = null, teacherNotes = undefined }) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    setSuccessMsg('');
    const request = { itemOverrides: overrides, finalize, finalGrade, ...(teacherNotes === undefined ? {} : { teacherNotes }) };
    const fingerprint = `${submissionId}:${JSON.stringify(request)}`;
    if (!reviewKeysRef.current.has(fingerprint)) reviewKeysRef.current.set(fingerprint, crypto.randomUUID());
    try {
      await requestJson(`/api/submissions/${encodeURIComponent(submissionId)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...request, idempotencyKey: reviewKeysRef.current.get(fingerprint) })
      });
      reviewKeysRef.current.delete(fingerprint);
      setSuccessMsg(finalize ? 'Voto definitivo confermato e registrato.' : 'Correzione manuale salvata; il voto resta da confermare.');
      await loadAssessmentWorkspace(selectedAssessmentId);
      if (activeSubmission?.id === submissionId) await openSubmissionDetail(submissionId);
      if (correctionMode === 'question') setQuestionRefreshToken(current => current + 1);
    } catch (err) {
      setError(`La correzione non è stata salvata: ${err.message}. Puoi riprovare senza creare una nuova versione duplicata.`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const generateProposal = async () => {
    if (!activeSubmission || proposalBusy) return;
    if (!aiProposalAuthorized) {
      setError('Conferma prima di inviare le risposte al servizio di valutazione configurato.');
      return;
    }
    setProposalBusy(true);
    setError('');
    setSuccessMsg('');
    try {
      await requestJson(`/api/submissions/${encodeURIComponent(activeSubmission.id)}/grade`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluator: 'teacher-requested-proposal' })
      });
      setAiProposalAuthorized(false);
      setSuccessMsg('Proposta di correzione generata. Non modifica né conferma il voto del docente.');
      await loadAssessmentWorkspace(selectedAssessmentId);
      await openSubmissionDetail(activeSubmission.id);
    } catch (err) {
      setError(`La proposta non è stata generata: ${err.message}`);
    } finally {
      setProposalBusy(false);
    }
  };

  const saveStudentCorrections = async (finalize) => {
    if (!activeSubmission) return;
    let overrides;
    try { overrides = makeOverrides(itemDrafts, assessmentDetail?.items || []); }
    catch (err) { setError(err.message); return; }
    if (finalize && !finalGradeInput.trim()) {
      setError('Inserisci il voto o giudizio finale prima di confermare.');
      return;
    }
    await saveReview({
      submissionId: activeSubmission.id,
      overrides,
      finalize,
      finalGrade: finalize ? finalGradeInput.trim() : null,
      teacherNotes: teacherNotesInput
    });
  };

  const saveQuestionCorrection = async (row) => {
    const key = row.submission_id || row.student_id;
    const draft = questionDrafts[key];
    if (!row.submission_id) {
      setError('Lo studente non ha ancora avviato o salvato un tentativo.');
      return;
    }
    if (!draft || draft.score === '') {
      setError('Inserisci il punteggio del quesito prima di salvare.');
      return;
    }
    const score = Number(draft.score);
    const item = assessmentDetail?.items?.find(entry => entry.id === selectedItemId);
    if (!Number.isFinite(score) || score < 0 || score > item.max_score) {
      setError(`Il punteggio deve essere compreso tra 0 e ${item.max_score}.`);
      return;
    }
    await saveReview({
      submissionId: row.submission_id,
      overrides: [{ itemId: selectedItemId, score, feedback: draft.feedback || '', notes: draft.notes || '' }],
      finalize: false,
      teacherNotes: ''
    });
  };

  const exportUrl = format => selectedAssessmentId
    ? `/api/assessments/${encodeURIComponent(selectedAssessmentId)}/export?format=${encodeURIComponent(format)}`
    : '#';

  const renderStatistics = () => statistics && h('section', { className: 'card assessment-statistics-card', key: 'statistics' }, [
    h('div', { className: 'teacher-section-heading' }, [
      h('div', null, [
        h('h3', { className: 'card-title' }, 'Riepilogo valutazioni'),
        h('p', { className: 'text-muted text-sm' }, `Media, deviazione standard e distribuzione calcolate soltanto sui ${statistics.finalGradeDenominator} voti definitivi confermati.`)
      ]),
      h('div', { className: 'export-actions' }, [
        h('a', { className: 'btn btn-sm btn-secondary', href: exportUrl('csv'), download: true }, 'Esporta CSV'),
        h('a', { className: 'btn btn-sm btn-secondary', href: exportUrl('json'), download: true }, 'Esporta JSON'),
        h('a', { className: 'btn btn-sm btn-secondary', href: exportUrl('markdown'), target: '_blank', rel: 'noreferrer' }, 'Report')
      ])
    ]),
    h('div', { className: 'assessment-statistics-grid' }, [
      ['Consegne', statistics.submittedCount],
      ['Ritiri docente', statistics.withdrawnCount],
      ['Da correggere', statistics.awaitingCorrectionCount],
      ['Valutazioni concluse', statistics.gradingCompletedCount],
      ['Media punti definitivi', statistics.meanFinalScore ?? '—'],
      ['Deviazione standard punti', statistics.populationStdDevFinalScore ?? '—'],
      ['Denominatore media', statistics.finalGradeDenominator]
    ].map(([label, value]) => h('div', { className: 'assessment-statistic', key: label }, [
      h('strong', null, String(value)), h('span', { className: 'text-muted text-sm' }, label)
    ]))),
    h('div', { className: 'score-distribution', 'aria-label': 'Distribuzione dei voti definitivi' }, statistics.scoreDistribution.map(band =>
      h('div', { className: 'score-distribution-row', key: band.id }, [
        h('span', null, band.label),
        h('span', { className: 'score-distribution-count' }, String(band.count))
      ])
    ))
  ]);

  const updateItemDraft = (itemId, field, value) => setItemDrafts(previous => ({
    ...previous,
    [itemId]: { ...(previous[itemId] || {}), [field]: value }
  }));

  const renderResponseCard = (item, draft, evaluation, index) => h('article', { className: 'card correction-question-card', key: item.id }, [
    h('div', { className: 'correction-question-heading' }, [
      h('div', null, [
        h('span', { className: 'eyebrow' }, `Q${index + 1} · ${item.type}`),
        h('h4', null, item.question_text)
      ]),
      h('span', { className: 'badge badge-neutral' }, `Max ${item.max_score} pt`)
    ]),
    h('div', { className: 'correction-response' }, [
      h('span', { className: 'detail-label' }, 'Risposta salvata'),
      item.type === 'code'
        ? h('pre', { className: 'code-block' }, draft?.responseText || 'Nessuna risposta salvata.')
        : h('p', { className: 'whitespace-pre-wrap' }, draft?.responseText || 'Nessuna risposta salvata.'),
      draft?.attachmentName && h('span', { className: 'badge badge-info' }, `Allegato: ${draft.attachmentName}`)
    ]),
    evaluation && h('p', { className: 'evaluation-source-note' }, `${currentEvaluationLabel(evaluation.evaluation_type)} · round ${evaluation.evaluation_round} · ${evaluation.score}/${evaluation.max_score}`),
    item.teacher_solution && h('details', { className: 'teacher-solution-details' }, [
      h('summary', null, 'Soluzione riservata al docente'),
      h('p', { className: 'whitespace-pre-wrap' }, item.teacher_solution)
    ]),
    item.rubric && h('p', { className: 'text-muted text-sm' }, `Criteri: ${JSON.stringify(item.rubric)}`),
    h('div', { className: 'correction-fields-grid' }, [
      h('label', { className: 'form-group' }, [
        h('span', { className: 'field-label' }, 'Punteggio'),
        h('input', {
          type: 'number', min: 0, max: item.max_score, step: '0.1', inputMode: 'decimal',
          className: 'text-input', value: draft?.score ?? '',
          onChange: e => updateItemDraft(item.id, 'score', e.target.value),
          'aria-label': `Punteggio quesito ${index + 1}`
        })
      ]),
      h('label', { className: 'form-group' }, [
        h('span', { className: 'field-label' }, 'Feedback allo studente'),
        h('textarea', {
          className: 'text-input', rows: 2, value: draft?.feedback || '',
          onChange: e => updateItemDraft(item.id, 'feedback', e.target.value),
          'aria-label': `Feedback quesito ${index + 1}`
        })
      ]),
      h('label', { className: 'form-group correction-notes-field' }, [
        h('span', { className: 'field-label' }, 'Annotazione docente · riservata'),
        h('textarea', {
          className: 'text-input', rows: 2, value: draft?.notes || '',
          onChange: e => updateItemDraft(item.id, 'notes', e.target.value),
          'aria-label': `Annotazione docente quesito ${index + 1}`
        })
      ])
    ])
  ]);

  const renderStudentModal = () => activeSubmission && h('div', {
    className: 'modal-overlay',
    role: 'presentation',
    onClick: () => setActiveSubmission(null)
  }, [
    h('section', { className: 'modal-card modal-large correction-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'correction-modal-title', onClick: e => e.stopPropagation() }, [
      h('div', { className: 'modal-header' }, [
        h('div', null, [
          h('p', { className: 'eyebrow' }, 'Consegna salvata sul server'),
          h('h3', { className: 'modal-title', id: 'correction-modal-title' }, `Correzione · ${activeSubmission.student_name || activeSubmission.student_id}`),
          h('span', { className: 'text-muted text-sm' }, `Consegna: ${activeSubmission.submitted_at ? new Date(activeSubmission.submitted_at).toLocaleString() : 'non finalizzata'} · stato ${activeSubmission.attempt_status}`)
        ]),
        h('button', { className: 'modal-close-btn', onClick: () => setActiveSubmission(null), 'aria-label': 'Chiudi correzione' }, '✕')
      ]),
      h('div', { className: 'modal-body correction-modal-body' }, [
        h('div', { className: 'grading-authority-note' }, 'Le proposte deterministiche o AI restano separate: soltanto il docente conferma il voto definitivo.'),
        h('section', { className: 'card proposal-action-panel' }, [
          h('h4', null, 'Proposta di correzione automatica'),
          h('p', { className: 'text-muted text-sm' }, 'L’azione invia le risposte salvate al valutatore configurato, che può includere un servizio AI. Usala solo se consentito dalle regole della scuola e dopo aver verificato le condizioni di trattamento dei dati. La proposta non è un voto finale.'),
          h('label', { className: 'proposal-authorization' }, [
            h('input', { type: 'checkbox', checked: aiProposalAuthorized, onChange: event => setAiProposalAuthorized(event.target.checked) }),
            'Confermo di essere autorizzato a richiedere questa valutazione per la consegna selezionata.'
          ]),
          h('button', { type: 'button', className: 'btn btn-secondary', disabled: proposalBusy || !aiProposalAuthorized, onClick: generateProposal }, proposalBusy ? 'Generazione proposta…' : 'Genera proposta deterministica e AI')
        ]),
        (assessmentDetail?.items || []).map((item, index) => {
          const evaluation = bestEvaluation(activeSubmission.evaluations, item.id);
          return renderResponseCard(item, itemDrafts[item.id], evaluation, index);
        }),
        h('section', { className: 'card final-grade-panel' }, [
          h('h4', null, 'Decisione finale del docente'),
          h('label', { className: 'form-group' }, [
            h('span', { className: 'field-label' }, 'Voto o giudizio definitivo'),
            h('input', { type: 'text', className: 'text-input', value: finalGradeInput, onChange: e => setFinalGradeInput(e.target.value), placeholder: 'Es. 8, 8/10, Buono' })
          ]),
          h('label', { className: 'form-group' }, [
            h('span', { className: 'field-label' }, 'Nota complessiva docente'),
            h('textarea', { className: 'text-input', rows: 2, value: teacherNotesInput, onChange: e => setTeacherNotesInput(e.target.value) })
          ]),
          h('div', { className: 'review-actions' }, [
            h('button', { className: 'btn btn-secondary', disabled: saving, onClick: () => saveStudentCorrections(false) }, saving ? 'Salvataggio…' : 'Salva correzioni, senza confermare il voto'),
            h('button', { className: 'btn btn-primary', disabled: saving, onClick: () => saveStudentCorrections(true) }, saving ? 'Salvataggio…' : 'Conferma voto definitivo')
          ])
        ]),
        activeSubmission.actionEvents?.length > 0 && h('details', { className: 'teacher-action-history' }, [
          h('summary', null, `Storico azioni docente (${activeSubmission.actionEvents.length})`),
          h('ul', null, activeSubmission.actionEvents.map(event => h('li', { key: event.id }, [
            h('strong', null, event.action),
            h('span', null, ` · ${event.created_at}`),
            event.reason && h('span', null, ` · ${event.reason}`)
          ])))
        ])
      ]),
      h('div', { className: 'modal-footer' }, [
        h('button', { className: 'btn btn-secondary', onClick: () => setActiveSubmission(null) }, 'Chiudi')
      ])
    ])
  ]);

  const selectedItem = assessmentDetail?.items?.find(item => item.id === selectedItemId) || null;

  return h('div', { className: 'submissions-view' }, [
    h('header', { className: 'teacher-page-intro', key: 'intro' }, [
      h('div', null, [
        h('p', { className: 'eyebrow' }, statusFilter === 'reviewed' ? 'Archivio docente' : 'Correzione'),
        h('h2', null, statusFilter === 'reviewed' ? 'Valutazioni concluse' : 'Consegne da correggere'),
        h('p', { className: 'text-muted' }, 'Rivedi le risposte persistite, salva correzioni progressive e conferma il voto solo quando è pronto.')
      ])
    ]),
    h('section', { className: 'card view-controls-card', key: 'controls' }, [
      h('div', { className: 'view-controls-grid submissions-controls-grid' }, [
        h('label', { className: 'form-group' }, [
          h('span', { className: 'field-label' }, 'Classe'),
          h('select', { className: 'select-input', value: selectedClassId, onChange: e => setSelectedClassId(e.target.value) }, classes.map(c => h('option', { key: c.id, value: c.id }, `${c.name} (${c.academic_year})`)))
        ]),
        h('label', { className: 'form-group' }, [
          h('span', { className: 'field-label' }, 'Attività'),
          h('select', { className: 'select-input', value: selectedAssessmentId, onChange: e => setSelectedAssessmentId(e.target.value), disabled: assessments.length === 0 }, assessments.length
            ? assessments.map(a => h('option', { key: a.id, value: a.id }, a.title))
            : h('option', { value: '' }, 'Nessuna attività'))
        ]),
        h('div', { className: 'review-filter-switch', role: 'group', 'aria-label': 'Modalità di correzione' }, [
          h('button', { className: `btn btn-sm ${correctionMode === 'student' ? 'btn-primary' : 'btn-secondary'}`, onClick: () => setCorrectionMode('student') }, 'Per studente'),
          h('button', { className: `btn btn-sm ${correctionMode === 'question' ? 'btn-primary' : 'btn-secondary'}`, onClick: () => setCorrectionMode('question') }, 'Per quesito')
        ]),
        h('div', { className: 'review-filter-switch', role: 'group', 'aria-label': 'Filtra valutazioni' }, [
          h('button', { className: `btn btn-sm ${statusFilter === 'pending' ? 'btn-primary' : 'btn-secondary'}`, onClick: () => setStatusFilter('pending') }, 'Da completare'),
          h('button', { className: `btn btn-sm ${statusFilter === 'reviewed' ? 'btn-primary' : 'btn-secondary'}`, onClick: () => setStatusFilter('reviewed') }, 'Concluse')
        ]),
        h('button', { className: 'btn btn-secondary', onClick: () => loadAssessmentWorkspace(), disabled: !selectedAssessmentId || loading }, loading ? 'Aggiornamento…' : 'Aggiorna')
      ])
    ]),
    error && h('div', { className: 'alert alert-error', role: 'alert', key: 'error' }, error),
    successMsg && h('div', { className: 'alert alert-success', role: 'status', key: 'success' }, successMsg),
    renderStatistics(),
    correctionMode === 'student'
      ? h('section', { className: 'card submissions-list-card', key: 'student-list' }, [
        h('div', { className: 'teacher-section-heading' }, [
          h('div', null, [h('h3', { className: 'card-title' }, 'Consegne'), h('p', { className: 'text-muted text-sm' }, `${visibleSubmissions.length} elementi in questa vista`)])
        ]),
        loading ? h('p', { className: 'text-muted' }, 'Caricamento consegne…') : visibleSubmissions.length === 0
          ? h('div', { className: 'teacher-queue-empty' }, 'Nessuna consegna corrisponde al filtro selezionato.')
          : h('div', { className: 'submissions-card-list' }, visibleSubmissions.map(submission => h('article', { className: 'submission-summary-card', key: submission.id }, [
            h('div', { className: 'submission-summary-main' }, [
              h('div', null, [
                h('p', { className: 'eyebrow' }, submission.attempt_status === 'teacher_withdrawn' ? 'Ritirata dal docente' : submission.status === 'reviewed' ? 'Voto confermato' : submission.status === 'graded' ? 'Proposta disponibile' : 'Da correggere'),
                h('h4', null, submission.student_name || submission.student_id),
                h('span', { className: 'text-muted text-sm' }, submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : 'Tentativo in corso')
              ]),
              h('div', { className: 'submission-summary-grade' }, [
                h('strong', null, submission.final_grade || submission.proposed_grade || '—'),
                h('span', { className: 'text-muted text-sm' }, submission.final_grade ? 'Definitivo' : submission.proposed_grade ? 'Proposta' : 'Nessun voto')
              ])
            ]),
            h('div', { className: 'submission-summary-actions' }, [
              h('span', { className: 'badge badge-neutral' }, `${submission.total_score ?? '—'} / ${assessmentDetail?.max_score ?? '—'} pt`),
              h('button', { className: 'btn btn-sm btn-primary', onClick: () => openSubmissionDetail(submission.id) }, statusFilter === 'reviewed' ? 'Apri valutazione' : 'Esamina e correggi')
            ])
          ])))
      ])
      : h('section', { className: 'question-review-workspace', key: 'question-list' }, [
        h('section', { className: 'card question-review-toolbar' }, [
          h('div', null, [h('h3', { className: 'card-title' }, 'Correzione per quesito'), h('p', { className: 'text-muted text-sm' }, 'Confronta le risposte salvate allo stesso quesito, senza automatizzare giudizi sullo studente.')]),
          h('label', { className: 'form-group' }, [
            h('span', { className: 'field-label' }, 'Quesito'),
            h('select', { className: 'select-input', value: selectedItemId, onChange: e => setSelectedItemId(e.target.value) }, (assessmentDetail?.items || []).map((item, index) => h('option', { key: item.id, value: item.id }, `Q${index + 1} · max ${item.max_score} pt`)))
          ])
        ]),
        selectedItem && h('div', { className: 'card question-review-prompt' }, [
          h('span', { className: 'eyebrow' }, `Massimo ${selectedItem.max_score} punti`),
          h('h3', null, selectedItem.question_text),
          selectedItem.rubric && h('p', { className: 'text-muted text-sm' }, `Criteri: ${JSON.stringify(selectedItem.rubric)}`),
          selectedItem.teacher_solution && h('details', { className: 'teacher-solution-details' }, [h('summary', null, 'Soluzione riservata al docente'), h('p', null, selectedItem.teacher_solution)])
        ]),
        questionLoading ? h('p', { className: 'text-muted' }, 'Caricamento risposte salvate…') : questionResponses.length === 0
          ? h('div', { className: 'card teacher-queue-empty' }, 'Nessun alunno presente nel registro della classe.')
          : h('div', { className: 'question-response-list' }, questionResponses.map(row => {
            const key = row.submission_id || row.student_id;
            const draft = questionDrafts[key] || { score: '', feedback: '', notes: '', responseText: '' };
            return h('article', { className: 'card question-response-card', key }, [
              h('div', { className: 'question-response-heading' }, [
                h('div', null, [h('h4', null, row.student_name || row.student_id), h('span', { className: 'text-muted text-sm' }, row.submission_id ? `Ultimo salvataggio: ${row.last_saved_at ? new Date(row.last_saved_at).toLocaleString() : 'non disponibile'}` : 'Non ha ancora avviato la prova')]),
                row.current_evaluation_type && h('span', { className: 'badge badge-info' }, currentEvaluationLabel(row.current_evaluation_type))
              ]),
              h('div', { className: 'question-student-response' }, row.response_text || 'Nessuna risposta salvata.'),
              h('div', { className: 'correction-fields-grid' }, [
                h('label', { className: 'form-group' }, [h('span', { className: 'field-label' }, `Punteggio · max ${selectedItem.max_score}`), h('input', { type: 'number', min: 0, max: selectedItem.max_score, step: '0.1', inputMode: 'decimal', className: 'text-input', value: draft.score, onChange: e => setQuestionDrafts(prev => ({ ...prev, [key]: { ...draft, score: e.target.value } })) })]),
                h('label', { className: 'form-group' }, [h('span', { className: 'field-label' }, 'Feedback allo studente'), h('textarea', { rows: 2, className: 'text-input', value: draft.feedback, onChange: e => setQuestionDrafts(prev => ({ ...prev, [key]: { ...draft, feedback: e.target.value } })) })]),
                h('label', { className: 'form-group correction-notes-field' }, [h('span', { className: 'field-label' }, 'Annotazione docente · riservata'), h('textarea', { rows: 2, className: 'text-input', value: draft.notes, onChange: e => setQuestionDrafts(prev => ({ ...prev, [key]: { ...draft, notes: e.target.value } })) })])
              ]),
              h('div', { className: 'question-response-footer' }, [
                row.final_grade && h('span', { className: 'badge badge-success' }, `Voto definitivo: ${row.final_grade}`),
                h('button', { className: 'btn btn-sm btn-primary', disabled: saving || !row.submission_id, onClick: () => saveQuestionCorrection(row) }, saving ? 'Salvataggio…' : 'Salva correzione del quesito')
              ])
            ]);
          }))
      ]),
    renderStudentModal()
  ]);
}
