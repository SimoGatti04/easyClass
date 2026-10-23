import React, { createElement as h, useEffect, useMemo, useState } from "react";

const DECISIONS = [
  { value: "pending", label: "Da esaminare" },
  { value: "reviewed_no_action", label: "Esaminata · nessuna azione" },
  { value: "needs_follow_up", label: "Approfondimento docente" }
];

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Richiesta non riuscita (${response.status})`);
  return payload;
}

const studentLabel = (student) => student?.studentName || student?.studentId || "Studente";

export function IntegrityPreviewView({ initialAssessmentId }) {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(initialAssessmentId || "");
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [reviewChoices, setReviewChoices] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});

  useEffect(() => {
    let active = true;
    requestJson("/api/classes").then((payload) => {
      if (!active) return;
      const rows = payload.classes || [];
      setClasses(rows);
      if (rows.length) setSelectedClassId(rows[0].id);
    }).catch((err) => active && setError(`Impossibile caricare le classi: ${err.message}`));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedClassId) { setAssessments([]); setSelectedAssessmentId(""); return; }
    let active = true;
    setError("");
    requestJson(`/api/assessments?classId=${encodeURIComponent(selectedClassId)}`).then((payload) => {
      if (!active) return;
      const rows = payload.assessments || [];
      setAssessments(rows);
      const preferred = rows.find((item) => item.id === initialAssessmentId);
      setSelectedAssessmentId(preferred?.id || rows[0]?.id || "");
    }).catch((err) => active && setError(`Impossibile caricare le attività: ${err.message}`));
    return () => { active = false; };
  }, [selectedClassId, initialAssessmentId]);

  const loadAnalysis = async (assessmentId = selectedAssessmentId) => {
    if (!assessmentId) { setAnalysis(null); return; }
    setLoading(true); setError(""); setNotice("");
    try {
      const payload = await requestJson(`/api/assessments/${encodeURIComponent(assessmentId)}/integrity-preview`);
      const report = payload.integrityAnalysis || null;
      setAnalysis(report);
      const choices = {}, notes = {};
      for (const item of report?.evidence || []) {
        choices[item.id] = item.review?.decision || "pending";
        notes[item.id] = item.review?.note || "";
      }
      setReviewChoices(choices); setReviewNotes(notes);
    } catch (err) { setError(`Impossibile caricare l’analisi: ${err.message}`); setAnalysis(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAnalysis(selectedAssessmentId); }, [selectedAssessmentId]);

  const typeOptions = useMemo(() => [...new Set((analysis?.evidence || []).map((entry) => entry.kind))], [analysis]);
  const visibleEvidence = (analysis?.evidence || []).filter((entry) =>
    (typeFilter === "all" || entry.kind === typeFilter) &&
    (decisionFilter === "all" || (entry.review?.decision || "pending") === decisionFilter)
  );

  const saveReview = async (entry) => {
    setSavingId(entry.id); setError(""); setNotice("");
    try {
      const payload = await requestJson(`/api/assessments/${encodeURIComponent(selectedAssessmentId)}/integrity-reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidenceId: entry.id,
          decision: reviewChoices[entry.id] || "pending",
          note: reviewNotes[entry.id] || "",
          idempotencyKey: globalThis.crypto?.randomUUID?.() || `review-${Date.now()}-${Math.random().toString(16).slice(2)}`
        })
      });
      const report = payload.integrityAnalysis || analysis;
      setAnalysis(report);
      const updated = report?.evidence?.find((candidate) => candidate.id === entry.id);
      if (updated) {
        setReviewChoices((current) => ({ ...current, [entry.id]: updated.review?.decision || "pending" }));
        setReviewNotes((current) => ({ ...current, [entry.id]: updated.review?.note || "" }));
      }
      setNotice("Revisione salvata nello storico. Non modifica il voto e non costituisce un giudizio disciplinare.");
    } catch (err) { setError(`Revisione non salvata: ${err.message}`); }
    finally { setSavingId(""); }
  };

  return h("main", { className: "integrity-page", "aria-labelledby": "integrity-page-title" }, [
    h("section", { key: "intro", className: "card integrity-intro" }, [
      h("div", { className: "integrity-intro-heading" }, [
        h("div", { className: "integrity-symbol", "aria-hidden": "true" }, "◇"),
        h("div", null, [h("p", { className: "eyebrow" }, "Area docente · C6"), h("h1", { id: "integrity-page-title" }, "Integrità ed evidenze"), h("p", { className: "text-muted" }, "Osservazioni verificabili, fonti didattiche e contesto d’aula. La valutazione e ogni decisione restano al docente.")])
      ]),
      h("div", { className: "integrity-principle", role: "note" }, [h("strong", null, "Importante. "), "La vicinanza, una risposta simile o un riscontro automatico non sono prova di copiatura. Nessun punteggio di colpevolezza o sanzione viene generato."])
    ]),
    h("section", { key: "controls", className: "card integrity-controls" }, [
      h("div", { className: "integrity-controls-grid" }, [
        h("div", { className: "form-group" }, [h("label", { className: "field-label", htmlFor: "integrity-class" }, "Classe"), h("select", { id: "integrity-class", className: "select-input", value: selectedClassId, onChange: (event) => setSelectedClassId(event.target.value) }, classes.map((item) => h("option", { key: item.id, value: item.id }, `${item.name} (${item.academic_year})`)))]),
        h("div", { className: "form-group" }, [h("label", { className: "field-label", htmlFor: "integrity-assessment" }, "Verifica / esercitazione"), h("select", { id: "integrity-assessment", className: "select-input", value: selectedAssessmentId, disabled: !assessments.length, onChange: (event) => setSelectedAssessmentId(event.target.value) }, assessments.length ? assessments.map((item) => h("option", { key: item.id, value: item.id }, `${item.title} · ${item.activity_type === "exercise" ? "Esercitazione" : "Verifica"}`)) : [h("option", { key: "none", value: "" }, "Nessuna attività disponibile")])]),
        h("button", { className: "btn btn-secondary integrity-refresh", onClick: () => loadAnalysis(), disabled: !selectedAssessmentId || loading }, loading ? "Analisi in corso…" : "Aggiorna analisi")
      ])
    ]),
    error ? h("div", { key: "error", className: "alert alert-error", role: "alert" }, error) : null,
    notice ? h("div", { key: "notice", className: "alert alert-success", role: "status" }, notice) : null,
    loading ? h("div", { key: "loading", className: "card integrity-empty", role: "status" }, "Lettura delle consegne finali e delle fonti didattiche associate…") : null,
    analysis ? h("section", { key: "report", className: "integrity-report" }, [
      h("div", { className: "integrity-summary" }, [
        h("div", { className: "card integrity-summary-card" }, [h("span", null, "Consegne analizzate"), h("strong", null, analysis.scope?.submittedAttempts ?? 0)]),
        h("div", { className: "card integrity-summary-card" }, [h("span", null, "Riscontri da esaminare"), h("strong", null, (analysis.evidence || []).filter((entry) => !entry.review || entry.review.decision === "pending").length)]),
        h("div", { className: "card integrity-summary-card" }, [h("span", null, "Contesti di fonte"), h("strong", null, analysis.sourceContexts?.length ?? 0)])
      ]),
      h("section", { className: "card integrity-evidence-section" }, [
        h("div", { className: "integrity-section-heading" }, [h("div", null, [h("h2", null, "Confronti tra consegne"), h("p", { className: "text-muted" }, "Ogni scheda mostra il riscontro osservato, i partecipanti e le spiegazioni alternative.")]), h("span", { className: "badge badge-neutral" }, `Analisi ${analysis.analysisVersion}`)]),
        h("div", { className: "integrity-filter-row" }, [
          h("div", { className: "form-group" }, [h("label", { className: "field-label", htmlFor: "integrity-type-filter" }, "Tipo di riscontro"), h("select", { id: "integrity-type-filter", className: "select-input", value: typeFilter, onChange: (event) => setTypeFilter(event.target.value) }, [h("option", { value: "all" }, "Tutti i tipi"), ...typeOptions.map((kind) => h("option", { key: kind, value: kind }, kind === "shared_code_token_shape" ? "Struttura lessicale del codice" : kind === "identical_extended_response" ? "Risposta estesa identica" : "Frase condivisa"))])]),
          h("div", { className: "form-group" }, [h("label", { className: "field-label", htmlFor: "integrity-review-filter" }, "Revisione docente"), h("select", { id: "integrity-review-filter", className: "select-input", value: decisionFilter, onChange: (event) => setDecisionFilter(event.target.value) }, [h("option", { value: "all" }, "Tutti gli stati"), ...DECISIONS.map((decision) => h("option", { key: decision.value, value: decision.value }, decision.label))])])
        ]),
        visibleEvidence.length ? h("div", { className: "integrity-evidence-list" }, visibleEvidence.map((entry) => h("article", { key: entry.id, className: "integrity-evidence-card" }, [
          h("div", { className: "integrity-evidence-header" }, [h("div", null, [h("span", { className: "badge badge-info" }, entry.kind === "shared_code_token_shape" ? "Struttura lessicale del codice" : entry.kind === "identical_extended_response" ? "Risposta estesa identica" : "Frase condivisa"), h("h3", null, entry.question || "Riscontro senza quesito associato")]), h("span", { className: "integrity-status-badge" }, DECISIONS.find((decision) => decision.value === (entry.review?.decision || "pending"))?.label || "Da esaminare")]),
          h("div", { className: "integrity-participants" }, (entry.attempts || []).map((student) => h("div", { key: student.submissionId, className: "integrity-participant" }, [h("strong", null, studentLabel(student)), h("p", null, student.excerpt || entry.matchedExcerpt || entry.observedPattern || "Risposta confrontata")]))),
          entry.matchedExcerpt ? h("p", { className: "integrity-observation" }, [h("strong", null, "Sequenza testuale condivisa: "), entry.matchedExcerpt]) : null,
          entry.observedPattern ? h("p", { className: "integrity-observation" }, [h("strong", null, "Schema osservato: "), entry.observedPattern]) : null,
          h("p", { className: "integrity-method" }, entry.method), h("p", { className: "integrity-interpretation" }, entry.interpretation),
          entry.seatContext?.length ? h("p", { className: "integrity-context-note" }, "Seat Map: postazioni vicine per almeno una coppia. La prossimità è solo contesto, mai evidenza autonoma.") : null,
          entry.sourceContext ? h("p", { className: "integrity-context-note" }, `Fonte associata: ${entry.sourceContext.title} · versione ${entry.sourceContext.version}.`) : null,
          h("div", { className: "integrity-review-form" }, [
            h("div", { className: "form-group" }, [h("label", { className: "field-label", htmlFor: `decision-${entry.id}` }, "Stato della revisione"), h("select", { id: `decision-${entry.id}`, className: "select-input", value: reviewChoices[entry.id] || entry.review?.decision || "pending", onChange: (event) => setReviewChoices((current) => ({ ...current, [entry.id]: event.target.value })) }, DECISIONS.map((decision) => h("option", { key: decision.value, value: decision.value }, decision.label)))]),
            h("div", { className: "form-group integrity-note-field" }, [h("label", { className: "field-label", htmlFor: `note-${entry.id}` }, "Nota docente · facoltativa"), h("textarea", { id: `note-${entry.id}`, className: "textarea-input", rows: 2, value: reviewNotes[entry.id] ?? entry.review?.note ?? "", onChange: (event) => setReviewNotes((current) => ({ ...current, [entry.id]: event.target.value })) })]),
            h("button", { className: "btn btn-primary", onClick: () => saveReview(entry), disabled: savingId === entry.id }, savingId === entry.id ? "Salvataggio…" : "Registra revisione")
          ]),
          entry.review?.history?.length ? h("details", { className: "integrity-history" }, [h("summary", null, `Storico revisioni (${entry.review.history.length})`), h("ol", null, entry.review.history.map((event) => h("li", { key: event.id }, `${event.created_at} · ${event.actor} · ${DECISIONS.find((decision) => decision.value === event.decision)?.label || event.decision}${event.note ? ` · ${event.note}` : ""}`)))]) : null
        ]))) : h("div", { className: "integrity-empty" }, [h("strong", null, typeFilter !== "all" || decisionFilter !== "all" ? "Nessun riscontro corrisponde ai filtri." : "Nessun riscontro secondo i controlli disponibili."), h("p", null, "L’assenza di riscontri non dimostra l’assenza di similarità o di problemi; le analisi hanno limiti espliciti.")])
      ]),
      analysis.sourceContexts?.length ? h("section", { className: "card integrity-context-section" }, [h("div", { className: "integrity-section-heading" }, [h("div", null, [h("h2", null, "Contesto delle fonti didattiche"), h("p", { className: "text-muted" }, "Confronto limitato a versioni pubblicate associate ai quesiti.")])]), h("div", { className: "integrity-context-list" }, analysis.sourceContexts.map((context) => h("article", { key: context.id, className: "integrity-source-context" }, [h("strong", null, studentLabel(context.student)), h("span", null, `${context.source?.title || "Materiale"} · v${context.source?.version}`), h("p", null, context.sharedExcerpt), h("small", null, context.interpretation)])))]) : null,
      analysis.seatContexts?.length ? h("section", { className: "card integrity-context-section" }, [h("div", { className: "integrity-section-heading" }, [h("div", null, [h("h2", null, "Prossimità Seat Map · solo contesto"), h("p", { className: "text-muted" }, "Non genera riscontri e non entra nel grading.")])]), h("ul", { className: "integrity-seat-list" }, analysis.seatContexts.map((context) => h("li", { key: context.id }, `${context.attempts.map(studentLabel).join(" · ")} — ${context.relation === "adjacent_seats" ? "postazioni adiacenti" : "vicinanza dichiarata"}. ${context.interpretation}`)))]) : null,
      h("section", { className: "card integrity-limitations" }, [h("h2", null, "Limiti dell’analisi"), h("ul", null, (analysis.limitations || []).map((limitation, index) => h("li", { key: index }, limitation))), h("p", { className: "integrity-policy" }, analysis.decisionPolicy)])
    ]) : null
  ]);
}
