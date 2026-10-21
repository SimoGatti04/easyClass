import React, { createElement as h, useState, useEffect } from "react";

export function SubmissionsView({ initialAssessmentId }) {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(initialAssessmentId || "");

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Detailed submission modal
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Review form state
  const [finalGradeInput, setFinalGradeInput] = useState("");
  const [isGradingInProgress, setIsGradingInProgress] = useState(false);

  // 1. Load classes
  useEffect(() => {
    fetch("/api/classes")
      .then(res => res.json())
      .then(data => {
        if (data.classes && data.classes.length > 0) {
          setClasses(data.classes);
          setSelectedClassId(data.classes[0].id);
        }
      })
      .catch(err => setError("Errore classi: " + err.message));
  }, []);

  // 2. Load assessments
  useEffect(() => {
    if (!selectedClassId) return;
    fetch(`/api/assessments?classId=${encodeURIComponent(selectedClassId)}`)
      .then(res => res.json())
      .then(data => {
        const asms = data.assessments || [];
        setAssessments(asms);
        if (initialAssessmentId && asms.some(a => a.id === initialAssessmentId)) {
          setSelectedAssessmentId(initialAssessmentId);
        } else if (asms.length > 0) {
          setSelectedAssessmentId(asms[0].id);
        } else {
          setSelectedAssessmentId("");
          setSubmissions([]);
        }
      })
      .catch(err => setError("Errore attività: " + err.message));
  }, [selectedClassId, initialAssessmentId]);

  // 3. Load submissions for assessment
  const loadSubmissions = (asmId) => {
    if (!asmId) return;
    setLoading(true);
    setError("");
    fetch(`/api/assessments/${encodeURIComponent(asmId)}/submissions`)
      .then(res => res.json())
      .then(data => {
        setSubmissions(data.submissions || []);
        setLoading(false);
      })
      .catch(err => {
        setError("Errore caricamento consegne: " + err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedAssessmentId) {
      loadSubmissions(selectedAssessmentId);
    } else {
      setSubmissions([]);
    }
  }, [selectedAssessmentId]);

  // 4. View submission details
  const openSubmissionDetail = (subId) => {
    setLoadingDetail(true);
    fetch(`/api/submissions/${encodeURIComponent(subId)}`)
      .then(res => res.json())
      .then(data => {
        setActiveSubmission(data.submission);
        setFinalGradeInput(data.submission.final_grade || data.submission.proposed_grade || "");
        setLoadingDetail(false);
      })
      .catch(err => {
        setError("Errore caricamento dettaglio consegna: " + err.message);
        setLoadingDetail(false);
      });
  };

  // 5. Run AI/Deterministic Grading
  const triggerAutoGrading = (subId) => {
    setIsGradingInProgress(true);
    setError("");
    fetch(`/api/submissions/${encodeURIComponent(subId)}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evaluator: "omniroute-teacher-assistant" })
    })
      .then(res => {
        if (!res.ok) throw new Error("Errore durante la correzione automatica");
        return res.json();
      })
      .then(() => {
        setSuccessMsg("Valutazione assistita completata con successo!");
        openSubmissionDetail(subId);
        loadSubmissions(selectedAssessmentId);
        setIsGradingInProgress(false);
      })
      .catch(err => {
        setError("Errore valutazione: " + err.message);
        setIsGradingInProgress(false);
      });
  };

  // 6. Save Teacher Final Review & Grade
  const saveTeacherReview = () => {
    if (!activeSubmission) return;
    if (!finalGradeInput.trim()) {
      alert("Inserisci un voto o giudizio finale per confermare.");
      return;
    }

    setLoading(true);
    fetch(`/api/submissions/${encodeURIComponent(activeSubmission.id)}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        finalGrade: finalGradeInput.trim(),
        reviewer: "Docente",
        itemOverrides: []
      })
    })
      .then(res => {
        if (!res.ok) throw new Error("Errore salvataggio revisione docente");
        return res.json();
      })
      .then(data => {
        setSuccessMsg("Voto finale e revisione docente registrati!");
        setActiveSubmission(data.submission);
        loadSubmissions(selectedAssessmentId);
        setLoading(false);
      })
      .catch(err => {
        setError("Errore salvataggio revisione: " + err.message);
        setLoading(false);
      });
  };

  const getReviewBadge = (sub) => {
    if (sub.status === "reviewed" || sub.final_grade) {
      return h("span", { className: "badge badge-success" }, `🏆 Valutato: ${sub.final_grade}`);
    }
    if (sub.status === "graded" || sub.proposed_grade) {
      return h("span", { className: "badge badge-info" }, `🤖 Proposta AI: ${sub.proposed_grade}`);
    }
    return h("span", { className: "badge badge-warning" }, "⏳ Da Valutare");
  };

  return h("div", { className: "submissions-view" }, [
    // Top Controls Card
    h("div", { key: "top-controls", className: "card view-controls-card" }, [
      h("div", { className: "view-controls-grid" }, [
        h("div", { className: "form-group" }, [
          h("label", { className: "field-label" }, "Classe"),
          h("select", {
            className: "select-input",
            value: selectedClassId,
            onChange: e => setSelectedClassId(e.target.value)
          }, classes.map(c => h("option", { key: c.id, value: c.id }, `${c.name} (${c.academic_year})`)))
        ]),

        h("div", { className: "form-group" }, [
          h("label", { className: "field-label" }, "Verifica / Esercitazione"),
          h("select", {
            className: "select-input",
            value: selectedAssessmentId,
            onChange: e => setSelectedAssessmentId(e.target.value),
            disabled: assessments.length === 0
          }, assessments.length === 0
            ? [h("option", { key: "none", value: "" }, "Nessuna attività trovata")]
            : assessments.map(a => h("option", { key: a.id, value: a.id }, `${a.title} (${a.activity_type === "exercise" ? "Esercitazione" : "Verifica"})`))
          )
        ]),

        h("div", { className: "view-actions-group" }, [
          h("button", {
            className: "btn btn-secondary",
            onClick: () => loadSubmissions(selectedAssessmentId),
            disabled: !selectedAssessmentId || loading
          }, "🔄 Ricarica Consegne"),
          selectedAssessmentId && h("a", {
            className: "btn btn-secondary",
            href: `/api/assessments/${encodeURIComponent(selectedAssessmentId)}/export?format=csv`,
            target: "_blank"
          }, "📥 Esporta CSV")
        ])
      ])
    ]),

    error && h("div", { key: "err", className: "alert alert-error" }, error),
    successMsg && h("div", { key: "succ", className: "alert alert-success" }, successMsg),

    // Submissions Table Card
    h("div", { key: "table-card", className: "card submissions-table-card" }, [
      h("div", { className: "card-header" }, [
        h("h3", { className: "card-title" }, [
          "Elenco Consegne Ricevute (",
          submissions.length,
          ")"
        ])
      ]),
      h("div", { className: "table-responsive" }, [
        h("table", { className: "data-table" }, [
          h("thead", null, [
            h("tr", null, [
              h("th", null, "Studente"),
              h("th", null, "Data Consegna"),
              h("th", null, "Postazione Seat Map"),
              h("th", null, "Punteggio / Max"),
              h("th", null, "Stato Valutazione"),
              h("th", null, "Azioni")
            ])
          ]),
          h("tbody", null, submissions.length === 0
            ? [h("tr", { key: "empty" }, [
                h("td", { colSpan: 6, className: "text-center py-6 text-muted" },
                  "Nessuna consegna registrata per questa attività."
                )
              ])]
            : submissions.map(sub => {
                return h("tr", { key: sub.id }, [
                  h("td", { className: "font-semibold" }, sub.student_name || sub.student_id),
                  h("td", null, sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : "—"),
                  h("td", null, sub.seat_row ? `${sub.seat_row}, ${sub.seat_desk}` : "—"),
                  h("td", null, sub.total_score != null ? `${sub.total_score} pt` : "—"),
                  h("td", null, getReviewBadge(sub)),
                  h("td", null, [
                    h("button", {
                      className: "btn btn-sm btn-primary",
                      onClick: () => openSubmissionDetail(sub.id)
                    }, "🔍 Esamina e Valuta")
                  ])
                ]);
              })
          )
        ])
      ])
    ]),

    // Detailed Submission & Grading Modal
    activeSubmission && h("div", { className: "modal-overlay", onClick: () => setActiveSubmission(null) }, [
      h("div", { className: "modal-card modal-large", onClick: e => e.stopPropagation() }, [
        h("div", { className: "modal-header" }, [
          h("div", null, [
            h("h3", { className: "modal-title" }, `Consegna di: ${activeSubmission.student_name || activeSubmission.student_id}`),
            h("span", { className: "text-muted text-sm" }, [
              `Postazione: ${activeSubmission.seat_row || "—"} (${activeSubmission.seat_desk || "—"}) — Consegnato il: ${new Date(activeSubmission.submitted_at).toLocaleString()}`
            ])
          ]),
          h("button", { className: "modal-close-btn", onClick: () => setActiveSubmission(null) }, "✕")
        ]),

        h("div", { className: "modal-body" }, [
          // Grading Action Banner (Separation of AI proposal and final teacher authority)
          h("div", { className: "card p-4 mb-4 bg-light" }, [
            h("div", { className: "flex justify-between items-center" }, [
              h("div", null, [
                h("h4", { className: "font-bold text-base mb-1" }, "Correzione e Autorità Docente (Dossier 06)"),
                h("p", { className: "text-sm text-muted" },
                  "Le valutazioni AI o deterministiche sono solo proposte non distruttive. Il voto definitivo appartiene esclusivamente al docente."
                )
              ]),
              h("button", {
                className: "btn btn-secondary",
                onClick: () => triggerAutoGrading(activeSubmission.id),
                disabled: isGradingInProgress
              }, isGradingInProgress ? "🤖 Valutazione in corso..." : "🤖 Ricalcola Proposta AI")
            ]),

            // Final Grade Input Box
            h("div", { className: "mt-4 pt-4 border-t flex items-center gap-4" }, [
              h("div", { className: "flex-1" }, [
                h("label", { className: "field-label" }, "Voto / Giudizio Finale Docente:"),
                h("input", {
                  type: "text",
                  className: "text-input font-bold text-lg",
                  placeholder: "Es: 8+, 28/30, Ottimo",
                  value: finalGradeInput,
                  onChange: e => setFinalGradeInput(e.target.value)
                })
              ]),
              h("button", {
                className: "btn btn-primary btn-lg mt-5",
                onClick: saveTeacherReview,
                disabled: loading
              }, "💾 Conferma e Salva Voto Finale")
            ])
          ]),

          // Questions and Student Responses
          h("h4", { className: "font-bold text-base mb-3" }, "Risposte della Prova:"),
          h("div", { className: "submission-responses-list" }, activeSubmission.responses.map((resp, idx) => {
            return h("div", { key: resp.id || idx, className: "card p-4 mb-3 border" }, [
              h("div", { className: "flex justify-between mb-2" }, [
                h("span", { className: "font-semibold" }, `Q${idx + 1}. ${resp.question_text}`),
                h("span", { className: "badge badge-neutral" }, `Max: ${resp.max_score} pt (${resp.type})`)
              ]),

              // Student's Response
              h("div", { className: "bg-gray-50 p-3 rounded mb-2 border" }, [
                h("div", { className: "text-xs font-semibold text-muted uppercase mb-1" }, "Risposta dello Studente:"),
                resp.type === "code"
                  ? h("pre", { className: "code-block" }, resp.response_text || "Nessuna risposta.")
                  : h("div", { className: "whitespace-pre-wrap" }, resp.response_text || "Nessuna risposta.")
              ]),

              // Attachment if any
              resp.attachment_path && h("div", { className: "attachment-box mb-2" }, [
                h("span", { className: "text-sm" }, [
                  "📎 Allegato consegnato: ",
                  h("strong", null, resp.attachment_name || "File allegato")
                ])
              ]),

              // Teacher Protected Solution & Rubric (Application-layer protected)
              h("div", { className: "teacher-solution-box mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded" }, [
                h("div", { className: "text-xs font-bold text-amber-800 uppercase mb-1" }, "🔒 Soluzione Docente e Criteri Rubrica:"),
                h("div", { className: "text-sm text-amber-900" }, resp.teacher_solution || "Nessuna soluzione indicata."),
                resp.rubric_json && h("div", { className: "text-xs text-muted mt-1" }, [
                  "Criteri rubrica: ",
                  JSON.stringify(resp.rubric_json)
                ])
              ])
            ]);
          }))
        ]),

        h("div", { className: "modal-footer" }, [
          h("button", { className: "btn btn-secondary", onClick: () => setActiveSubmission(null) }, "Chiudi")
        ])
      ])
    ])
  ]);
}
