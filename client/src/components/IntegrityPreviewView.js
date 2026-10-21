import React, { createElement as h, useState, useEffect } from "react";

export function IntegrityPreviewView({ initialAssessmentId }) {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(initialAssessmentId || "");

  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
          setPreviewData(null);
        }
      })
      .catch(err => setError("Errore attività: " + err.message));
  }, [selectedClassId, initialAssessmentId]);

  // 3. Load integrity preview data
  const loadIntegrityPreview = (asmId) => {
    if (!asmId) return;
    setLoading(true);
    fetch(`/api/assessments/${encodeURIComponent(asmId)}/integrity-preview`)
      .then(res => res.json())
      .then(data => {
        setPreviewData(data);
        setLoading(false);
      })
      .catch(err => {
        setError("Errore anteprima integrità: " + err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedAssessmentId) {
      loadIntegrityPreview(selectedAssessmentId);
    } else {
      setPreviewData(null);
    }
  }, [selectedAssessmentId]);

  const evidenceList = previewData?.evidence || [];

  return h("div", { className: "integrity-preview-view" }, [
    // Top Controls
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
            onClick: () => loadIntegrityPreview(selectedAssessmentId),
            disabled: !selectedAssessmentId || loading
          }, "🔄 Ricarica Evidenze")
        ])
      ])
    ]),

    // Explicit C6 Anteprima Badge Banner
    h("div", { key: "c6-banner", className: "card c6-preview-banner" }, [
      h("div", { className: "flex items-start gap-4" }, [
        h("div", { className: "banner-icon" }, "🛡️"),
        h("div", null, [
          h("div", { className: "flex items-center gap-2 mb-1" }, [
            h("span", { className: "badge badge-primary" }, "Anteprima Checkpoint C6"),
            h("h3", { className: "text-lg font-bold" }, "Sistema d'Integrità & Anticopiatura Multilivello")
          ]),
          h("p", { className: "text-sm text-muted mb-2" },
            "L'architettura di Teacher Service supporta l'analisi incrociata non invasiva: correlazione Seat Map d'aula, rilevamento errori rari, parti superflue identiche, similarità strutturale/semantica e confronto con materiali didattici o fonti web."
          ),
          h("div", { className: "integrity-principles-box p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900" }, [
            h("strong", null, "Principio Etico Fondamentale: "),
            previewData?.disclaimer || "I segnali di integrità sono elementi conoscitivi riservati al docente, mai sanzioni automatiche o punteggi di colpevolezza."
          ])
        ])
      ])
    ]),

    error && h("div", { key: "err", className: "alert alert-error" }, error),

    // Multilevel Architecture Pillars Card
    h("div", { key: "pillars-card", className: "card pillars-overview-card" }, [
      h("h4", { className: "font-bold text-base mb-3" }, "I 5 Livelli di Analisi d'Integrità (Checkpoint C6)"),
      h("div", { className: "pillars-grid" }, [
        h("div", { className: "pillar-item" }, [
          h("div", { className: "pillar-icon" }, "🪑"),
          h("div", { className: "pillar-title" }, "1. Seat Map & Prossimità"),
          h("div", { className: "pillar-desc" }, "Analisi delle correlazioni tra banchi adiacenti e dichiarazioni reciproche di vicinanza.")
        ]),
        h("div", { className: "pillar-item" }, [
          h("div", { className: "pillar-icon" }, "🔍"),
          h("div", { className: "pillar-title" }, "2. Errori Rari e Superflui"),
          h("div", { className: "pillar-desc" }, "Individuazione di errori identici rari o parti di codice/testo superflue condivise.")
        ]),
        h("div", { className: "pillar-item" }, [
          h("div", { className: "pillar-icon" }, "🧬"),
          h("div", { className: "pillar-title" }, "3. Struttura & Semantica"),
          h("div", { className: "pillar-desc" }, "Confronto AST e grafi di flusso per codice, similarità concettuale per testi aperti.")
        ]),
        h("div", { className: "pillar-item" }, [
          h("div", { className: "pillar-icon" }, "🌐"),
          h("div", { className: "pillar-title" }, "4. Fonti Web e Didattiche"),
          h("div", { className: "pillar-desc" }, "Confronto con dispense pubblicate e pagine web note, senza leakage di dati privati.")
        ]),
        h("div", { className: "pillar-item" }, [
          h("div", { className: "pillar-icon" }, "⚖️"),
          h("div", { className: "pillar-title" }, "5. Giudizio Docente Separato"),
          h("div", { className: "pillar-desc" }, "Evidenze e annotazioni del docente salvate in storico separato dal registro voti.")
        ])
      ])
    ]),

    // Evidence Records Card
    h("div", { key: "evidence-card", className: "card mt-4" }, [
      h("div", { className: "card-header flex justify-between items-center" }, [
        h("h3", { className: "card-title" }, [
          "Evidenze Rilevate per l'Attività (",
          evidenceList.length,
          ")"
        ]),
        h("span", { className: "badge badge-neutral" }, "Storico Riservato Docente")
      ]),
      h("div", { className: "card-body" }, [
        evidenceList.length === 0 ? (
          h("div", { className: "empty-state-card text-center py-8 text-muted" }, [
            h("div", { className: "text-3xl mb-2" }, "🌱"),
            h("h4", { className: "font-semibold text-base mb-1" }, "Nessuna correlazione anomala rilevata"),
            h("p", { className: "text-sm" },
              "I banchi adiacenti e le risposte analizzate presentano una distribuzione indipendente standard."
            )
          ])
        ) : (
          h("div", { className: "evidence-items-list" }, evidenceList.map(ev => {
            return h("div", { key: ev.id, className: "card p-4 mb-3 border border-gray-200" }, [
              h("div", { className: "flex justify-between items-start mb-2" }, [
                h("div", null, [
                  h("span", { className: "badge badge-info mr-2" }, ev.type),
                  h("strong", { className: "text-base" }, ev.summary)
                ]),
                h("span", { className: "badge badge-success" }, "Verificato normale")
              ]),
              h("div", { className: "text-sm text-gray-700 mb-2" }, ev.details),
              h("div", { className: "flex gap-4 text-xs text-muted" }, [
                h("span", null, [h("strong", null, "Studenti coinvolti: "), ev.students.join(", ")]),
                h("span", null, [h("strong", null, "Indice similarità: "), ev.similarityIndex]),
                h("span", null, [h("strong", null, "Revisione richiesta: "), ev.requiresTeacherReview ? "Sì" : "No"])
              ])
            ]);
          }))
        )
      ])
    ])
  ]);
}
